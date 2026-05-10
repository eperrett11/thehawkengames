import React, { useMemo, useState } from 'react';
import { useTournament } from '../store';
import { EventType } from '../types';

const PLACEHOLDER_SRC = '/images/player-card-placeholder.jpg';
const PLAYER_CARD_SRC: Record<string, string> = {
  Andrew: '/images/playercards/andrew.jpg',
  Ben: '/images/playercards/ben.jpg',
  Bobby: '/images/playercards/bobby.jpg',
  Brendan: '/images/playercards/brendan.jpg',
  Clay: '/images/playercards/clay.jpg',
  Cole: '/images/playercards/cole.jpg',
  Connor: '/images/playercards/connor.jpg',
  Eli: '/images/playercards/eli.jpg',
  Forrest: '/images/playercards/forrest.jpg',
  Hawken: '/images/playercards/hawken.jpg',
  Jack: '/images/playercards/jack.jpg',
  Jordan: '/images/playercards/jordan.jpg',
  Justin: '/images/playercards/justin.jpg',
  Kai: '/images/playercards/kai.jpg',
  Luke: '/images/playercards/luke.jpg',
  Nolan: '/images/playercards/nolan.jpg',
  Sam: '/images/playercards/sam.jpg'
};

const getPlayerCardSrc = (name: string) => PLAYER_CARD_SRC[name] || PLAYER_CARD_SRC[name.split(' ')[0]] || PLACEHOLDER_SRC;

const Leaderboard: React.FC = () => {
  const { state } = useTournament();
  const [leaderboardType, setLeaderboardType] = useState<'team' | 'individual' | 'betting'>('team');

  const teamLeaderboard = useMemo(() => {
    return state.teams
      .map((team) => {
        const wins = state.events.filter((event) => event.winnerTeamId === team.id || event.winnerTeamIds?.includes(team.id)).length;
        return { ...team, wins };
      })
      .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
  }, [state.teams, state.events]);

  const individualLeaderboard = useMemo(() => {
    const winCounts = new Map<string, number>();

    state.events
      .filter((event) => event.type !== EventType.AGGREGATE)
      .forEach((event) => {
        event.matchups?.forEach((matchup) => {
          matchup.winningPlayerIds?.forEach((playerId) => {
            winCounts.set(playerId, (winCounts.get(playerId) || 0) + 1);
          });
        });
      });

    return state.players
      .map((player) => {
        const team = state.teams.find((entry) => entry.playerIds.includes(player.id));
        return {
          ...player,
          wins: winCounts.get(player.id) || 0,
          teamColor: team?.color || 'Team',
          colorHex: team?.colorHex || '#64748b'
        };
      })
      .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
  }, [state.events, state.players, state.teams]);

  const bettingLeaderboard = useMemo(() => {
    const isVoidBettableItem = (itemId?: string) => {
      if (!itemId) return false;
      const item = state.bettableItems.find((entry) => entry.id === itemId);
      if (!item || item.status !== 'SETTLED') return false;

      const itemBets = state.bets.filter((bet) => bet.bettableItemId === itemId);
      if (itemBets.length === 0) return false;

      return new Set(itemBets.map((bet) => bet.optionId)).size <= 1;
    };

    return state.players
      .map((player) => {
        const team = state.teams.find((entry) => entry.playerIds.includes(player.id));
        const playerBets = state.bets.filter((bet) => bet.playerId === player.id);
        const activeCount = playerBets.filter((bet) => {
          const item = state.bettableItems.find((entry) => entry.id === bet.bettableItemId);
          return item?.status === 'OPEN' && !bet.refunded && !bet.voided;
        }).length;
        const paidOutSettledBets = playerBets.filter((bet) => {
          const item = state.bettableItems.find((entry) => entry.id === bet.bettableItemId);
          return item?.status === 'SETTLED' && !bet.refunded && !bet.voided && !isVoidBettableItem(bet.bettableItemId);
        });
        const wonCount = paidOutSettledBets.filter((bet) => {
          const item = state.bettableItems.find((entry) => entry.id === bet.bettableItemId);
          return item?.winnerOptionId === bet.optionId;
        }).length;
        const lostCount = paidOutSettledBets.length - wonCount;

        return {
          ...player,
          activeCount,
          wonCount,
          lostCount,
          teamColor: team?.color || 'Team',
          colorHex: team?.colorHex || '#64748b'
        };
      })
      .sort((a, b) => b.wonCount - a.wonCount || a.name.localeCompare(b.name));
  }, [state.players, state.teams, state.bets, state.bettableItems]);

  const leaderboardTabClass = (active: boolean) => (
    `relative z-10 rounded-xl py-4 text-[11px] font-black uppercase tracking-[0.1em] transition-all ${
      active
        ? 'bg-white text-black shadow-lg'
        : 'text-slate-500'
    }`
  );

  return (
    <div className="flex h-full flex-col overflow-hidden px-3 py-4 animate-in fade-in duration-500">
      <div className="relative mb-3 grid grid-cols-3 gap-2 rounded-2xl border border-slate-800 bg-slate-900/75 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        {leaderboardType === 'betting' && (
          <div className="pointer-events-none absolute bottom-3 left-1/3 top-3 w-px -translate-x-1/2 bg-white/10" />
        )}
        {leaderboardType === 'team' && (
          <div className="pointer-events-none absolute bottom-3 left-2/3 top-3 w-px -translate-x-1/2 bg-white/10" />
        )}
        <button
          type="button"
          onClick={() => setLeaderboardType('team')}
          className={leaderboardTabClass(leaderboardType === 'team')}
        >
          Teams
        </button>
        <button
          type="button"
          onClick={() => setLeaderboardType('individual')}
          className={leaderboardTabClass(leaderboardType === 'individual')}
        >
          Individual
        </button>
        <button
          type="button"
          onClick={() => setLeaderboardType('betting')}
          className={leaderboardTabClass(leaderboardType === 'betting')}
        >
          Betting
        </button>
      </div>

      {leaderboardType === 'team' ? (
        <div className="grid min-h-0 flex-1 grid-rows-[repeat(4,minmax(0,1fr))] gap-1.5 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
          {teamLeaderboard.map((team, idx) => (
            <div
              key={team.id}
              className="relative min-h-0 overflow-hidden rounded-xl border border-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              style={{
                background: `linear-gradient(135deg, ${team.colorHex}E0 0%, ${team.colorHex}A8 18%, ${team.colorHex}63 42%, rgba(18,24,44,0.94) 100%)`
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_16%,rgba(255,255,255,0)_40%)]" />
              <div className="relative flex h-full items-center justify-between gap-3 px-4 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="w-10 text-center text-2xl font-black italic text-white/35">{idx + 1}</div>
                  <div className="min-w-0">
                    <div className="whitespace-nowrap text-xl font-black italic uppercase tracking-tight text-white sm:text-2xl">
                      {team.name}
                    </div>
                  </div>
                </div>

                <div className="min-w-[76px] rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-2 text-center">
                  <div className="text-3xl font-black leading-none text-white">{team.wins}</div>
                  <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/65">Wins</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : leaderboardType === 'individual' ? (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
          {individualLeaderboard.map((player, idx) => (
            <div
              key={player.id}
              className="relative flex min-h-0 items-center justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-800/70 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 pl-1">
                <div className="w-6 shrink-0 text-center text-xl font-black italic text-white/28">{idx + 1}</div>
                <div
                  className="h-14 w-11 shrink-0 overflow-hidden rounded-lg border bg-slate-950"
                  style={{ borderColor: `${player.colorHex}CC` }}
                >
                  <img
                    src={getPlayerCardSrc(player.name)}
                    alt={`${player.name} player card`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="overflow-visible whitespace-nowrap text-base font-black uppercase italic leading-snug tracking-tight text-white sm:text-lg">{player.name}</div>
                  <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: player.colorHex }}>
                    {player.teamColor} Team
                  </div>
                </div>
              </div>

              <div className="shrink-0 rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2 text-center">
                <div className="text-2xl font-black leading-none text-white">{player.wins}</div>
                <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-slate-500">Wins</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
          {bettingLeaderboard.map((player, idx) => (
            <div
              key={player.id}
              className="relative rounded-xl border border-slate-700/80 bg-slate-800/70 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              <div className="flex items-center gap-2 pl-1">
                <div className="w-6 shrink-0 text-center text-xl font-black italic text-white/28">{idx + 1}</div>
                <div
                  className="h-14 w-11 shrink-0 overflow-hidden rounded-lg border bg-slate-950"
                  style={{ borderColor: `${player.colorHex}CC` }}
                >
                  <img
                    src={getPlayerCardSrc(player.name)}
                    alt={`${player.name} player card`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="overflow-visible whitespace-nowrap text-base font-black uppercase italic leading-snug tracking-tight text-white sm:text-lg">{player.name}</div>
                  <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: player.colorHex }}>
                    {player.teamColor} Team
                  </div>
                </div>
                <div className="shrink-0 space-y-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                  <div className="grid grid-cols-[1.25rem_auto] gap-1">
                    <span className="text-right text-white/70">{player.activeCount}</span>
                    <span>Active</span>
                  </div>
                  <div className="grid grid-cols-[1.25rem_auto] gap-1">
                    <span className="text-right text-white/70">{player.wonCount}</span>
                    <span>Won</span>
                  </div>
                  <div className="grid grid-cols-[1.25rem_auto] gap-1">
                    <span className="text-right text-white/70">{player.lostCount}</span>
                    <span>Lost</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-500">Bankroll</div>
                  <div className="mt-1 text-lg font-black leading-none text-emerald-400">${player.balance.toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
