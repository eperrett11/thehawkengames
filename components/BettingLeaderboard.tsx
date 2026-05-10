import React, { useMemo } from 'react';
import { useTournament } from '../store';

const BettingLeaderboard: React.FC = () => {
  const { state } = useTournament();

  const bettingLeaderboard = useMemo(() => {
    return state.players
      .map((player) => {
        const playerBets = state.bets.filter((bet) => bet.playerId === player.id && !bet.refunded && !bet.voided);
        const settledPlayerBets = playerBets.filter((bet) => {
          const item = state.bettableItems.find((entry) => entry.id === bet.bettableItemId);
          return item?.status === 'SETTLED';
        });

        return {
          ...player,
          activeCount: playerBets.length - settledPlayerBets.length,
          settledCount: settledPlayerBets.length
        };
      })
      .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  }, [state.players, state.bets, state.bettableItems]);

  return (
    <div className="space-y-3 px-2 py-2 pb-24 animate-in fade-in duration-500">
      {bettingLeaderboard.map((player, idx) => (
        <div
          key={player.id}
          className="rounded-[24px] border border-slate-800 bg-[linear-gradient(145deg,rgba(15,23,42,0.98)_0%,rgba(8,15,35,0.95)_100%)] px-3 py-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 text-center text-2xl font-black italic leading-none text-white/25">{idx + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="text-base font-black italic uppercase tracking-tight text-white truncate">{player.name}</div>
              <div className="mt-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {player.activeCount} active • {player.settledCount} settled
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Bankroll</div>
              <div className="mt-1 text-xl font-black leading-none text-emerald-400">${player.balance.toFixed(2)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BettingLeaderboard;
