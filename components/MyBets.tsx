import React, { useMemo } from 'react';
import { useTournament } from '../store';
import { EventType } from '../types';

type UserBetRow = {
  id: string;
  itemId: string;
  eventId?: string;
  eventName: string;
  itemLabel: string;
  pickLabel: string;
  pickTeamColor?: string;
  amount: number;
  payout: number;
  currentPayout?: number;
  wouldVoid: boolean;
  settled: boolean;
  won: boolean;
  refunded: boolean;
};

const formatBetLabel = (eventName: string, itemLabel: string) => {
  const gameMatch = itemLabel.match(/^Game\s+(\d+)$/i);
  if (!gameMatch) return itemLabel;

  const gameNumber = Number(gameMatch[1]);

  if (['Pickleball', 'Spikeball', 'Beer Dye'].includes(eventName)) {
    if (gameNumber >= 1 && gameNumber <= 4) return `Quarterfinal Game ${gameNumber}`;
    if (gameNumber >= 5 && gameNumber <= 6) return `Semi Final Game ${gameNumber - 4}`;
    if (gameNumber === 7) return 'Final Game';
  }

  if (['Volleyball', 'Soccer', 'Basketball'].includes(eventName)) {
    if (gameNumber >= 1 && gameNumber <= 2) return `Semi Final Game ${gameNumber}`;
    if (gameNumber === 3) return 'Final Game';
  }

  if (eventName === 'Baseball' && gameNumber === 1) {
    return 'Final Game';
  }

  return itemLabel;
};

const formatPickLabel = (state: ReturnType<typeof useTournament>['state'], eventId?: string, itemId?: string, fallbackLabel?: string, optionId?: string) => {
  const event = state.events.find((entry) => entry.id === eventId);
  const item = state.bettableItems.find((entry) => entry.id === itemId);
  const matchup = event?.matchups?.find((entry) => entry.id === item?.matchupId);
  const resolvedTeam = state.teams.find((entry) => entry.id === optionId)
    || state.teams.find((entry) => fallbackLabel?.toLowerCase() === entry.id.toLowerCase())
    || state.teams.find((entry) => fallbackLabel?.toLowerCase().includes(entry.color.toLowerCase()));

  if (event?.type === EventType.PAIRED && matchup) {
    const winnerIndex = matchup.participantIds?.findIndex((participantId) => participantId === optionId) ?? -1;
    const teamId = winnerIndex >= 0 ? matchup.participantTeamIds?.[winnerIndex] : '';
    const team = state.teams.find((entry) => entry.id === teamId) || resolvedTeam;

    if (matchup.round === 'Semifinal' || matchup.round === 'Final') {
      return team?.name || matchup.participants?.[winnerIndex] || fallbackLabel || 'Unknown Pick';
    }

    return fallbackLabel?.replace(/^[A-Za-z]+ Team [AB]:\s*/i, '') || fallbackLabel || 'Unknown Pick';
  }

  if (event?.type === EventType.TEAM_BRACKET || event?.type === EventType.AGGREGATE) {
    return resolvedTeam?.name || fallbackLabel || 'Unknown Pick';
  }

  return resolvedTeam?.name || fallbackLabel || 'Unknown Pick';
};

const getPickTeamColor = (state: ReturnType<typeof useTournament>['state'], eventId?: string, itemId?: string, optionId?: string, fallbackLabel?: string) => {
  const event = state.events.find((entry) => entry.id === eventId);
  const item = state.bettableItems.find((entry) => entry.id === itemId);
  const matchup = event?.matchups?.find((entry) => entry.id === item?.matchupId);

  if (matchup && optionId) {
    const winnerIndex = matchup.participantIds?.findIndex((participantId) => participantId === optionId) ?? -1;
    const teamId = winnerIndex >= 0 ? matchup.participantTeamIds?.[winnerIndex] : optionId;
    const team = state.teams.find((entry) => entry.id === teamId);
    if (team) return team.colorHex;
  }

  const fallbackTeam = state.teams.find((entry) => fallbackLabel?.toLowerCase().includes(entry.color.toLowerCase()));
  return fallbackTeam?.colorHex;
};

const getCurrentPayout = (state: ReturnType<typeof useTournament>['state'], itemId: string, optionId: string, amount: number) => {
  const itemBets = state.bets.filter((bet) => bet.bettableItemId === itemId && !bet.refunded && !bet.voided);
  const totalPool = itemBets.reduce((acc, bet) => acc + bet.amount, 0);
  const optionPool = itemBets
    .filter((bet) => bet.optionId === optionId)
    .reduce((acc, bet) => acc + bet.amount, 0);

  if (totalPool <= 0 || optionPool <= 0) return amount;
  return (amount / optionPool) * totalPool;
};

const wouldCurrentBetVoid = (state: ReturnType<typeof useTournament>['state'], itemId: string) => {
  const optionIds = new Set(
    state.bets
      .filter((bet) => bet.bettableItemId === itemId && !bet.refunded && !bet.voided)
      .map((bet) => bet.optionId)
  );

  return optionIds.size <= 1;
};

const MyBets: React.FC = () => {
  const { state, currentUser } = useTournament();

  const userBets = useMemo<UserBetRow[]>(() => {
    if (!currentUser) return [];

    return state.bets
      .filter((bet) => bet.playerId === currentUser.id)
      .map((bet) => {
        const item = state.bettableItems.find((entry) => entry.id === bet.bettableItemId);
        const event = state.events.find((entry) => entry.id === item?.eventId);
        const option = item?.options.find((entry) => entry.id === bet.optionId);
        const settled = item?.status === 'SETTLED' || !!bet.voided;
        const won = settled && item?.winnerOptionId === bet.optionId;

        return {
          id: bet.id,
          itemId: bet.bettableItemId,
          eventId: event?.id,
          eventName: event?.name || 'Unknown Event',
          itemLabel: item?.label || 'Unknown Bet',
          pickLabel: formatPickLabel(state, event?.id, item?.id, option?.label, bet.optionId),
          pickTeamColor: getPickTeamColor(state, event?.id, item?.id, bet.optionId, option?.label),
          amount: bet.amount,
          payout: bet.payout || 0,
          currentPayout: item?.status === 'OPEN' ? getCurrentPayout(state, bet.bettableItemId, bet.optionId, bet.amount) : undefined,
          wouldVoid: item?.status === 'OPEN' ? wouldCurrentBetVoid(state, bet.bettableItemId) : false,
          settled: !!settled,
          won: !!won,
          refunded: !!bet.refunded || !!bet.voided
        };
      })
      .sort((a, b) => Number(a.settled) - Number(b.settled) || a.eventName.localeCompare(b.eventName));
  }, [state.bets, state.bettableItems, state.events, currentUser]);

  const openUserBets = userBets.filter((bet) => !bet.settled);
  const pastUserBets = userBets.filter((bet) => bet.settled);
  const bettingTotals = pastUserBets.reduce(
    (totals, bet) => {
      if (bet.refunded) return totals;
      if (bet.won) {
        return { ...totals, won: totals.won + Math.max(0, bet.payout - bet.amount) };
      }
      return { ...totals, lost: totals.lost + bet.amount };
    },
    { won: 0, lost: 0 }
  );

  const renderBetRows = (rows: UserBetRow[], emptyLabel: string, showResultBadge = false) => {
    if (rows.length === 0) {
      return <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-[11px] italic text-slate-500">{emptyLabel}</div>;
    }

    return (
      <div className="space-y-2.5">
        {rows.map((row) => {
          const profit = row.payout - row.amount;
          const resultLabel = row.refunded ? 'Returned' : row.won ? 'Won' : 'Lost';
          const resultValue = row.refunded ? row.amount : row.won ? Math.max(0, profit) : row.amount;
          const resultPrefix = row.refunded ? '' : row.won ? '+' : '-';
          const resultColor = row.refunded ? 'text-slate-300' : row.won ? 'text-emerald-400' : 'text-rose-300';

          return (
            <div key={row.id} className="rounded-2xl border border-slate-800 bg-[linear-gradient(135deg,rgba(15,23,42,0.96)_0%,rgba(15,23,42,0.72)_100%)] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{row.eventName}</div>
                  <div className="mt-1 text-[15px] font-black italic uppercase tracking-tight text-white">{formatBetLabel(row.eventName, row.itemLabel)}</div>
                  <div className="mt-2">
                    <span
                      className="inline-flex rounded-full border border-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-white"
                      style={{ background: row.pickTeamColor ? `linear-gradient(135deg, ${row.pickTeamColor}CC 0%, rgba(15,23,42,0.58) 100%)` : 'rgba(51,65,85,0.45)' }}
                    >
                      {row.pickLabel}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {showResultBadge ? (
                    <div className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${row.refunded ? 'bg-slate-700/60 text-slate-200' : row.won ? 'bg-emerald-500/12 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                      {row.refunded ? 'Void' : row.won ? 'Won' : 'Lost'}
                    </div>
                  ) : null}
                  {showResultBadge ? (
                    <div className="mt-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{resultLabel}</div>
                      <div className={`mt-1 whitespace-nowrap text-2xl font-black leading-none ${resultColor}`}>
                        {resultPrefix}${resultValue.toFixed(2)}
                      </div>
                    </div>
                  ) : null}
                  <div className={showResultBadge ? 'mt-2' : 'mt-3'}>
                    <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Wager</div>
                    <div className="mt-1 text-lg font-black leading-none text-white">${row.amount.toFixed(0)}</div>
                  </div>
                  {!row.settled && row.currentPayout !== undefined ? (
                    <div className="mt-2">
                      <div className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-500">Projected Payout</div>
                      <div className={`mt-0.5 text-sm font-black uppercase leading-none ${row.wouldVoid ? 'text-slate-400' : 'text-emerald-400'}`}>
                        {row.wouldVoid ? 'Void' : `$${row.currentPayout.toFixed(2)}`}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3 px-3 py-4 pb-24 animate-in fade-in duration-500">
      <section className="rounded-[24px] border border-slate-800 bg-[linear-gradient(145deg,rgba(15,23,42,0.98)_0%,rgba(8,15,35,0.95)_100%)] px-4 py-3">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Buy In</div>
              <a
                href="venmo://paycharge?txn=pay&recipients=Eli-Perrett"
                className="mt-1 inline-block break-all text-[17px] font-black tracking-tight text-white underline decoration-white/30 underline-offset-4"
              >
                @Eli-Perrett
              </a>
            </div>
            <div className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-400">
              Minimum $20
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Players start with a $0.00 bankroll. To fund betting, Venmo the commissioner. After payment is confirmed, the commissioner will add those funds to your account in the app.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/8 px-4 py-3">
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-400/80">Total Won</div>
          <div className="mt-1 text-2xl font-black tracking-tight text-emerald-400">${bettingTotals.won.toFixed(2)}</div>
        </div>
        <div className="rounded-2xl border border-rose-500/15 bg-rose-500/8 px-4 py-3">
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-rose-300/80">Total Lost</div>
          <div className="mt-1 text-2xl font-black tracking-tight text-rose-300">${bettingTotals.lost.toFixed(2)}</div>
        </div>
      </section>

      <section className="rounded-[22px] border border-slate-800 bg-[linear-gradient(145deg,rgba(15,23,42,0.98)_0%,rgba(8,15,35,0.96)_100%)] p-3.5 space-y-4">
        <div>
          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Open Bets</div>
          {renderBetRows(openUserBets, 'No open bets yet.')}
        </div>
        <div>
          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Past Bets</div>
          {renderBetRows(pastUserBets, 'No past bets yet.', true)}
        </div>
      </section>
    </div>
  );
};

export default MyBets;

















