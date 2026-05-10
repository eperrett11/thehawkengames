import { createClient } from '@supabase/supabase-js';
import { TournamentState } from './types';

type RemoteTournamentState = {
  state: TournamentState;
  revision: number;
};

const env = (import.meta as { env?: Record<string, string | undefined> }).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const isLocalHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const useApiBackend = typeof window !== 'undefined' && !isLocalHost;
const useDirectSupabase = Boolean(supabaseUrl && supabasePublishableKey) && !useApiBackend;

export const isBackendEnabled = useApiBackend || useDirectSupabase;

export const supabase = useDirectSupabase
  ? createClient(supabaseUrl as string, supabasePublishableKey as string)
  : null;

const requireSupabase = () => {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
};

export const loadRemoteTournamentState = async (): Promise<RemoteTournamentState | null> => {
  if (useApiBackend) {
    const response = await fetch('/api/state');
    if (!response.ok) throw new Error(`Failed to load app state: ${response.status}`);
    return await response.json();
  }

  const client = requireSupabase();
  const { data, error } = await client.rpc('get_app_state');

  if (error) throw error;
  if (!data) return null;

  return data as RemoteTournamentState;
};

export const seedRemoteTournamentState = async (state: TournamentState): Promise<RemoteTournamentState> => {
  if (useApiBackend) {
    const response = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seed', state })
    });
    if (!response.ok) throw new Error(`Failed to seed app state: ${response.status}`);
    return await response.json();
  }

  const client = requireSupabase();
  const { data, error } = await client.rpc('seed_app_state', { new_state: state });

  if (error) throw error;
  return data as RemoteTournamentState;
};

export const commitRemoteTournamentState = async (
  state: TournamentState,
  expectedRevision: number
): Promise<RemoteTournamentState> => {
  if (useApiBackend) {
    const response = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'commit', state, expectedRevision })
    });
    if (!response.ok) throw new Error(`Failed to save app state: ${response.status}`);
    return await response.json();
  }

  const client = requireSupabase();
  const { data, error } = await client.rpc('commit_app_state', {
    expected_revision: expectedRevision,
    new_state: state
  });

  if (error) throw error;
  return data as RemoteTournamentState;
};
