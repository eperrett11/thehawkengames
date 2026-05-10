import React, { useMemo, useState } from 'react';
import { useTournament } from '../store';
import { Player } from '../types';
import HawkenLogo from './HawkenLogo';

const STORAGE_KEY = 'hawken_games_v5';

const Login: React.FC = () => {
  const { state, setCurrentUser, refresh } = useTournament();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const selectedFromDropdown = useMemo(
    () => state.players.find(p => p.id === selectedPlayerId) || null,
    [state.players, selectedPlayerId]
  );
  const sortedPlayers = useMemo(
    () => [...state.players].sort((a, b) => a.name.localeCompare(b.name)),
    [state.players]
  );

  const handleJoin = () => {
    if (!selectedPlayer) return;
    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }

    const player = state.players.find(p => p.id === selectedPlayer.id);
    if (!player) {
      setError('Player not found');
      return;
    }

    if (player.pin && player.pin !== pin) {
      setError('Incorrect PIN');
      return;
    }

    const updatedPlayers = state.players.map(p => (
      p.id === selectedPlayer.id ? { ...p, pin: p.pin || pin } : p
    ));
    const updatedPlayer = updatedPlayers.find(p => p.id === selectedPlayer.id) || null;

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, players: updatedPlayers }));
    if (updatedPlayer) localStorage.setItem('hawken_user', JSON.stringify(updatedPlayer));
    setCurrentUser(updatedPlayer);
    refresh();
  };

  return (
    <div className="h-full min-h-full w-full px-4 py-3 sm:py-4 flex items-center justify-center overflow-hidden">
      <div className="w-full max-w-sm rounded-2xl bg-slate-950/70 backdrop-blur-sm p-5 sm:p-6 text-center shadow-xl space-y-8">
        <HawkenLogo className="mb-3" />

        {!selectedPlayer ? (
          <div className="space-y-3 pt-2">
            <div className="relative">
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-800 bg-slate-900 py-3 pl-4 pr-4 text-center text-sm font-semibold focus:border-slate-600 focus:outline-none"
              >
                <option value="" disabled>Choose a player</option>
                {sortedPlayers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 9l6 6 6-6" />
              </svg>
            </div>

            <button
              onClick={() => selectedFromDropdown && setSelectedPlayer(selectedFromDropdown)}
              disabled={!selectedFromDropdown}
              className={`w-full py-3 rounded-lg font-bold uppercase tracking-widest transition-all ${selectedFromDropdown ? 'bg-white text-black' : 'bg-slate-800 text-slate-500'}`}
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-4 duration-300">
            <button onClick={() => { setSelectedPlayer(null); setPin(''); setError(''); }} className="text-xs text-slate-500 font-bold uppercase mb-6 hover:text-white transition-colors flex items-center mx-auto">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Change Name
            </button>
            <h2 className="text-2xl font-bold mb-2">Welcome, {selectedPlayer.name}</h2>
            <p className="text-slate-400 text-sm mb-5">Create or enter your 4 digit pin</p>

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''));
                setError('');
              }}
              placeholder="0000"
              className="w-full bg-slate-900 border-2 border-slate-800 rounded-lg py-4 text-center text-3xl font-black tracking-[0.6em] pl-[0.6em] focus:border-slate-500 focus:outline-none mb-3"
            />
            {error && <p className="text-rose-500 text-xs font-bold uppercase mb-3">{error}</p>}

            <button
              onClick={handleJoin}
              disabled={pin.length !== 4}
              className={`w-full py-4 rounded-lg font-bold uppercase tracking-widest transition-all ${pin.length === 4 ? 'bg-white text-black' : 'bg-slate-800 text-slate-500'}`}
            >
              Enter Games
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;





