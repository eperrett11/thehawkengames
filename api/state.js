import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const getClient = () => {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
};

const sendJson = (response, statusCode, payload) => {
  response.status(statusCode).json(payload);
};

export default async function handler(request, response) {
  try {
    const supabase = getClient();

    if (request.method === 'GET') {
      const { data, error } = await supabase.rpc('get_app_state');
      if (error) throw error;
      return sendJson(response, 200, data);
    }

    if (request.method === 'POST') {
      const { action, state, expectedRevision } = request.body || {};

      if (action === 'seed') {
        const { data, error } = await supabase.rpc('seed_app_state', { new_state: state });
        if (error) throw error;
        return sendJson(response, 200, data);
      }

      if (action === 'commit') {
        const { data, error } = await supabase.rpc('commit_app_state', {
          new_state: state,
          expected_revision: expectedRevision
        });
        if (error) {
          const isConflict = error.message?.includes('STATE_CONFLICT');
          return sendJson(response, isConflict ? 409 : 500, { error: error.message });
        }
        return sendJson(response, 200, data);
      }

      return sendJson(response, 400, { error: 'Unknown action.' });
    }

    response.setHeader('Allow', 'GET, POST');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  } catch (error) {
    return sendJson(response, 500, { error: error.message || 'Unexpected backend error.' });
  }
}
