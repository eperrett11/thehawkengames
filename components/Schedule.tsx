import React, { useEffect, useRef, useState } from 'react';
import { useTournament } from '../store';
import { BettableItem, EventStatus, EventType, Matchup } from '../types';
import { Info } from 'lucide-react';
import { Icon, loadIcons } from '@iconify/react';
import BettingPanel from './BettingPanel';

interface ScheduleProps {
  onShowRules: (sport: string) => void;
  readOnly?: boolean;
}

const PAIRED_ROUNDS = ['Quarterfinal', 'Semifinal', 'Final'];
const BET_STAT_CLASS = 'mt-3 border-t border-white/12 pt-2 text-[9px] font-black uppercase leading-none tracking-[0.14em]';

const formatBetLabel = (eventName: string, itemLabel: string) => {
  const gameMatch = itemLabel.match(/^Game\s+(\d+)$/i);
  if (!gameMatch) return itemLabel;

  const gameNumber = Number(gameMatch[1]);

  if (['Pickleball', 'Spikeball', 'Beer Dye', 'Cornhole', 'ALT SPORT 2v2'].includes(eventName)) {
    if (gameNumber >= 1 && gameNumber <= 4) return `Quarterfinal Game ${gameNumber}`;
    if (gameNumber >= 5 && gameNumber <= 6) return `Semi Final Game ${gameNumber - 4}`;
    if (gameNumber === 7) return 'Final Game';
  }

  if (['Volleyball', 'Soccer', 'Basketball', 'ALT SPORT 4v4'].includes(eventName)) {
    if (gameNumber >= 1 && gameNumber <= 2) return `Semi Final Game ${gameNumber}`;
    if (gameNumber === 3) return 'Final Game';
  }

  if (eventName === 'Baseball' && gameNumber === 1) return 'Final Game';

  return itemLabel;
};

const Schedule: React.FC<ScheduleProps> = ({ onShowRules, readOnly = false }) => {
  const { state, currentUser } = useTournament();
  const [activeDay, setActiveDay] = useState<1 | 2>(1);
  const [openEventIds, setOpenEventIds] = useState<Set<string>>(new Set());
  const [activeBetItemId, setActiveBetItemId] = useState<string | null>(null);
  const scheduleRootRef = useRef<HTMLDivElement | null>(null);
  const eventCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const dayEvents = state.events.filter((e) => e.day === activeDay && e.isVisible);

  useEffect(() => {
    loadIcons([
      'material-symbols:pickleball-outline',
      'lucide:grid-3x3',
      'mdi:dice-5-outline',
      'mdi:volleyball',
      'ph:soccer-ball-fill',
      'mdi:basketball',
      'mdi:baseball',
      'fa6-solid:baseball-bat-ball',
      'mdi:golf',
      'mdi:swim',
      'mdi:target',
      'mdi:run-fast',
      'streamline-ultimate:swimming-diving-bold',
      'mdi:trophy-outline'
    ]);
  }, []);

  const upcomingEvents = dayEvents.filter(e => e.status !== EventStatus.COMPLETE);
  const completedEvents = dayEvents.filter(e => e.status === EventStatus.COMPLETE);

  const handleDayChange = (day: 1 | 2) => {
    setActiveDay(day);
    setOpenEventIds(new Set());
    setActiveBetItemId(null);

    requestAnimationFrame(() => {
      const scrollContainer = scheduleRootRef.current?.closest('main');
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
      } else {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    });
  };

  const handleToggleEvent = (eventId: string) => {
    const card = eventCardRefs.current[eventId];
    const beforeTop = card?.getBoundingClientRect().top ?? null;

    setOpenEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });

    if (beforeTop === null) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const updatedCard = eventCardRefs.current[eventId];
        const afterTop = updatedCard?.getBoundingClientRect().top ?? null;
        if (afterTop === null) return;

        const delta = afterTop - beforeTop;
        if (Math.abs(delta) > 1) {
          window.scrollBy({ top: delta, behavior: 'auto' });
        }
      });
    });
  };

  const getTeamColor = (teamId?: string) => {
    if (!teamId || teamId === 'TBD') return '#334155';
    const primaryTeamId = teamId.split('+')[0];
    return state.teams.find(t => t.id === primaryTeamId)?.colorHex || '#334155';
  };

  const getTeamColorName = (teamId?: string) => {
    if (!teamId || teamId === 'TBD') return 'TBD';
    const combinedTeamIds = teamId.split('+').filter(Boolean);
    const colorNames = combinedTeamIds
      .map((id) => state.teams.find((team) => team.id === id)?.color?.toUpperCase())
      .filter(Boolean);

    if (colorNames.length > 0) return colorNames.join(' + ');
    return state.teams.find(t => t.id === teamId)?.color.toUpperCase() || 'TEAM';
  };

  const getEventDisplayType = (type: EventType, eventName?: string) => {
    switch (type) {
      case EventType.PAIRED:
        return 'TOURNAMENT - PAIRED (2v2)';
      case EventType.TEAM_BRACKET:
        return 'TOURNAMENT - FULL TEAM (4v4)';
      case EventType.COMBINED_TEAM:
        return 'COMBINED TEAM EVENT (8v8)';
      case EventType.AGGREGATE:
        return 'AGGREGATE EVENT';
      default:
        return 'EVENT';
    }
  };

  const getDisplayEventName = (eventName: string) => {
    const normalized = eventName.toLowerCase();
    if (normalized.includes('baseball') && normalized.includes('derby')) {
      return 'baseball - HR derby';
    }
    return eventName;
  };

  const getSchedulePlayerName = (name: string) => name;

  const getEventIcon = (eventName: string) => {
    const iconMap: Record<string, string> = {
      'Pickleball': 'material-symbols:pickleball-outline',
      'Spikeball': 'lucide:grid-3x3',
      'Beer Dye': 'mdi:dice-5-outline',
      'Volleyball': 'mdi:volleyball',
      'Soccer': 'ph:soccer-ball-fill',
      'Cornhole': 'mdi:target',
      'Basketball': 'mdi:basketball',
      'Baseball': 'mdi:baseball',
      'baseball - HR derby': 'fa6-solid:baseball-bat-ball',
      'Golf': 'mdi:golf',
      'Mini Putt Golf': 'mdi:golf',
      'Swim Relay': 'mdi:swim',
      '100M Dash': 'mdi:run-fast',
      'Pool Diving Contest': 'streamline-ultimate:swimming-diving-bold'
    };

    return (
      <Icon
        icon={iconMap[getDisplayEventName(eventName)] || 'mdi:trophy-outline'}
        className="block w-6 h-6 text-white"
      />
    );
  };

  const getMatchupSideMembers = (eventType: EventType, match: Matchup, sideIndex: 0 | 1): string[] => {
    if (eventType === EventType.PAIRED && (match.round === 'Semifinal' || match.round === 'Final') && match.participantTeamIds?.[sideIndex]) {
      return [getTeamColorName(match.participantTeamIds[sideIndex])];
    }

    if (eventType === EventType.TEAM_BRACKET && match.round === 'Final' && match.participantTeamIds?.[sideIndex]) {
      return [getTeamColorName(match.participantTeamIds[sideIndex])];
    }
    const players = match.participantPlayers?.[sideIndex];
    if (players && players.length > 0) return players.map(getSchedulePlayerName);

    const participant = match.participants[sideIndex] || 'TBD';
    const team = state.teams.find(t => t.id === participant);
    if (!team) return [participant];

    return team.playerIds
      .map(pid => getSchedulePlayerName(state.players.find(p => p.id === pid)?.name || 'Unknown'))
      .filter(Boolean);
  };

  const getMatchupTeamId = (match: Matchup, sideIndex: 0 | 1) => {
    return match.participantTeamIds?.[sideIndex] || match.participants[sideIndex];
  };

  const getCombinedSideSegments = (match: Matchup, sideIndex: 0 | 1, sideMembers: string[]) => {
    const sideTeamId = getMatchupTeamId(match, sideIndex);
    const combinedTeamIds = sideTeamId?.split('+').filter(Boolean) || [];

    if (combinedTeamIds.length <= 1) {
      return [{ teamId: sideTeamId, members: sideMembers }];
    }

    let offset = 0;
    const segments = combinedTeamIds.map((teamId) => {
      const team = state.teams.find((entry) => entry.id === teamId);
      const memberCount = team?.playerIds.length || Math.ceil(sideMembers.length / combinedTeamIds.length);
      const members = sideMembers.slice(offset, offset + memberCount);
      offset += memberCount;
      return {
        teamId,
        members: members.length > 0 ? members : ['TBD']
      };
    });

    if (offset < sideMembers.length && segments.length > 0) {
      segments[segments.length - 1].members = segments[segments.length - 1].members.concat(sideMembers.slice(offset));
    }

    return segments;
  };

  const isResolvedBetItem = (itemId?: string) => {
    const item = state.bettableItems.find((entry) => entry.id === itemId);
    if (!item || item.status !== 'OPEN' || item.options.length < 2) return false;

    return item.options.every((option) => (
      option.id.trim() !== ''
      && option.id !== 'TBD'
      && option.label.trim() !== ''
      && !option.label.toUpperCase().includes('TBD')
    ));
  };

  const getMatchupBetItem = (eventId: string, matchId: string) => {
    return state.bettableItems.find((item) => item.eventId === eventId && item.matchupId === matchId && isResolvedBetItem(item.id));
  };

  const getAnyMatchupBetItem = (eventId: string, matchId: string) => {
    return state.bettableItems.find((item) => item.eventId === eventId && item.matchupId === matchId);
  };

  const getEventBetItem = (eventId: string) => {
    return state.bettableItems.find((item) => item.eventId === eventId && !item.matchupId && isResolvedBetItem(item.id));
  };

  const getBetItemPot = (itemId: string) => state.bets
    .filter((bet) => bet.bettableItemId === itemId && !bet.refunded && !bet.voided)
    .reduce((sum, bet) => sum + bet.amount, 0);

  const getBetOptionStat = (item: BettableItem | undefined, optionId: string) => {
    if (!item) return null;

    const itemBets = state.bets.filter((bet) => bet.bettableItemId === item.id && !bet.refunded && !bet.voided);
    const totalPool = itemBets.reduce((sum, bet) => sum + bet.amount, 0);
    const optionPool = itemBets
      .filter((bet) => bet.optionId === optionId)
      .reduce((sum, bet) => sum + bet.amount, 0);
    const percentage = totalPool > 0 ? (optionPool / totalPool) * 100 : 0;

    return { optionPool, percentage, totalPool };
  };

  const getScheduleOddsStat = (item: BettableItem | undefined, match: Matchup, sideIndex: 0 | 1) => {
    if (!item) return null;

    const sideParticipantId = match.participantIds?.[sideIndex] || '';
    const option = item.options.find((entry) => entry.id === sideParticipantId);
    if (!option) return null;

    return getBetOptionStat(item, option.id);
  };

  const renderScheduleBetButton = (itemId?: string) => {
    if (readOnly) return null;
    if (!itemId) return null;
    const item = state.bettableItems.find((entry) => entry.id === itemId);
    const isBettingLocked = item?.status !== 'OPEN' || item?.bettingLocked;
    const hasUserBet = !!currentUser && state.bets.some((bet) => bet.playerId === currentUser.id && bet.bettableItemId === itemId && !bet.refunded && !bet.voided);
    const latestPlayer = currentUser ? state.players.find((player) => player.id === currentUser.id) || currentUser : null;
    const hasFunds = (latestPlayer?.balance || 0) >= 5;

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!hasUserBet && !isBettingLocked) setActiveBetItemId(itemId);
        }}
        disabled={hasUserBet || isBettingLocked}
        className={`mx-auto mt-3 flex w-fit min-w-[112px] justify-center rounded-lg border px-3.5 py-2 text-[9px] font-black uppercase tracking-[0.16em] transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
          hasUserBet
            ? 'border-emerald-500/25 bg-transparent text-emerald-400'
            : isBettingLocked
              ? 'border-slate-700 bg-transparent text-slate-500'
            : 'border-white/20 bg-white/[0.03] text-white/90 shadow-[0_0_18px_rgba(255,255,255,0.04)]'
        }`}
      >
        {hasUserBet ? 'Bet Wagered' : isBettingLocked ? 'Betting Locked' : 'Place Bet'}
      </button>
    );
  };

  const renderSidePanel = (event: typeof dayEvents[number] | undefined, eventType: EventType, match: Matchup, sideIndex: 0 | 1, highlightWinner: boolean, betItem?: BettableItem) => {
    const matchupWinningTeamIds = new Set((match.winnerTeamId || '').split('+').filter(Boolean));
    const sideParticipantId = match.participantIds?.[sideIndex] || '';
    const sideTeamIds = (match.participantTeamIds?.[sideIndex] || '').split('+').filter(Boolean);
    const hasExactWinner = !!match.winnerId;
    const isWinner = hasExactWinner
      ? sideParticipantId === match.winnerId
      : matchupWinningTeamIds.size > 0 && sideTeamIds.some((teamId) => matchupWinningTeamIds.has(teamId));
    const isLoser = (hasExactWinner || matchupWinningTeamIds.size > 0) && !isWinner;
    const sideTeamId = getMatchupTeamId(match, sideIndex);
    const isRight = sideIndex === 1;
    const displayPlayers = [getMatchupSideMembers(eventType, match, 0), getMatchupSideMembers(eventType, match, 1)] as [string[], string[]];
    const segments = getCombinedSideSegments({ ...match, participantPlayers: displayPlayers }, sideIndex, displayPlayers[sideIndex]);
    const oddsStat = getScheduleOddsStat(betItem, match, sideIndex);

    return (
      <div
        className={`min-h-[68px] text-center ${isLoser ? 'opacity-20 saturate-[0.1] grayscale' : ''}`}
      >
        {segments.length === 1 ? (
          <div
            className="relative flex min-h-[68px] items-center justify-center overflow-visible rounded-xl px-3 py-3 ring-1 ring-inset ring-white/[0.06]"
            style={{
              background: isWinner
                ? `linear-gradient(145deg, ${getTeamColor(sideTeamId)}FF 0%, ${getTeamColor(sideTeamId)}D8 54%, rgba(15,23,42,0.54) 100%)`
                : `linear-gradient(145deg, ${getTeamColor(sideTeamId)}C8 0%, ${getTeamColor(sideTeamId)}82 50%, rgba(15,23,42,0.78) 100%)`,
              boxShadow: isWinner
                ? `inset 0 0 0 2px #86efac, inset 0 1px 0 rgba(255,255,255,0.22), 0 0 24px rgba(34,197,94,0.28), 0 12px 26px ${getTeamColor(sideTeamId)}40`
                : `inset 0 0 0 1px ${getTeamColor(sideTeamId)}80, inset 0 1px 0 rgba(255,255,255,0.08)`
            }}
          >
            {isWinner ? (
              <div className="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-300 text-[13px] font-black text-slate-950 shadow-[0_0_18px_rgba(134,239,172,0.45)]">
                ✓
              </div>
            ) : null}
            <div className="relative w-full space-y-0.5">
              {segments[0].members.map((member, idx) => (
                <div key={`${match.id}-${sideIndex}-${idx}`}>{member}</div>
              ))}
              {oddsStat ? (
                <div className={BET_STAT_CLASS}>
                  <span className="text-white/60">{oddsStat.percentage.toFixed(0)}%</span>
                  <span className="mx-1.5 text-white/25">|</span>
                  <span className="text-emerald-300/90">${oddsStat.optionPool.toFixed(0)}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col gap-1.5">
            {segments.map((segment, segmentIndex) => (
              <div
                key={`${match.id}-${sideIndex}-segment-${segment.teamId}-${segmentIndex}`}
                className="relative flex items-center justify-center overflow-visible rounded-xl px-3 py-3 text-center ring-1 ring-inset ring-white/[0.06]"
                style={{
                  background: isWinner
                    ? `linear-gradient(145deg, ${getTeamColor(segment.teamId)}FF 0%, ${getTeamColor(segment.teamId)}D8 54%, rgba(15,23,42,0.54) 100%)`
                    : `linear-gradient(145deg, ${getTeamColor(segment.teamId)}C8 0%, ${getTeamColor(segment.teamId)}82 50%, rgba(15,23,42,0.78) 100%)`,
                  boxShadow: isWinner
                    ? `inset 0 0 0 2px #86efac, inset 0 1px 0 rgba(255,255,255,0.22), 0 0 24px rgba(34,197,94,0.28), 0 12px 26px ${getTeamColor(segment.teamId)}40`
                    : `inset 0 0 0 1px ${getTeamColor(segment.teamId)}80, inset 0 1px 0 rgba(255,255,255,0.08)`
                }}
              >
                {isWinner && segmentIndex === 0 ? (
                  <div className="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-300 text-[13px] font-black text-slate-950 shadow-[0_0_18px_rgba(134,239,172,0.45)]">
                    ✓
                  </div>
                ) : null}
                <div className="relative w-full space-y-0.5">
                  {segment.members.map((member, idx) => (
                    <div key={`${match.id}-${sideIndex}-${segment.teamId}-${idx}`}>{member}</div>
                  ))}
                  {oddsStat && segmentIndex === 0 ? (
                    <div className={BET_STAT_CLASS}>
                      <span className="text-white/60">{oddsStat.percentage.toFixed(0)}%</span>
                      <span className="mx-1.5 text-white/25">|</span>
                      <span className="text-emerald-300/90">${oddsStat.optionPool.toFixed(0)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMatchupCard = (eventId: string, match: Matchup, stacked = false) => {
    const event = state.events.find((entry) => entry.id === eventId);
    const eventType = event?.type || EventType.AGGREGATE;
    const isFinished = !!match.winnerId;
    const highlightWinner = event?.status === EventStatus.COMPLETE;
    const hideBettingStats = eventType === EventType.PAIRED && match.round === 'Semifinal';
    const betItem = hideBettingStats ? undefined : getMatchupBetItem(eventId, match.id);
    const potItem = hideBettingStats ? undefined : betItem || getAnyMatchupBetItem(eventId, match.id);
    const totalPot = potItem ? getBetItemPot(potItem.id) : 0;

    return (
      <div key={match.id} className={`rounded-2xl p-3 shadow-[0_18px_42px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-inset ${isFinished ? 'bg-slate-950/64 ring-white/[0.13]' : 'bg-[linear-gradient(145deg,rgba(51,65,85,0.54)_0%,rgba(15,23,42,0.48)_44%,rgba(2,6,23,0.44)_100%)] ring-white/[0.18]'} ${stacked ? 'min-h-0' : ''}`}>
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div className="text-[11px] uppercase font-black tracking-[0.16em] text-slate-400">
            {match.gameNumber ? `Game ${match.gameNumber}` : match.round}
          </div>
          {potItem ? (
            <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">
              Total Pot <span className="text-emerald-300">${totalPot.toFixed(2)}</span>
            </div>
          ) : null}
        </div>

        <div className={isFinished ? 'opacity-95' : ''}>
          <div className="grid grid-cols-[minmax(0,1fr)_34px_minmax(0,1fr)] items-center gap-2 text-white text-[13px] font-black leading-tight">
            {renderSidePanel(event, eventType, match, 0, highlightWinner, betItem)}
            <div className="flex items-center justify-center text-center text-[13px] italic font-black tracking-wide text-white/90">
              VS
            </div>
            {renderSidePanel(event, eventType, match, 1, highlightWinner, betItem)}
          </div>
        </div>

        {!isFinished ? renderScheduleBetButton(betItem?.id) : null}
      </div>
    );
  };

  const renderPairedBracket = (event: typeof dayEvents[number]) => {
    const rounds = new Map<string, Matchup[]>();
    PAIRED_ROUNDS.forEach((round) => rounds.set(round, []));
    (event.matchups || []).forEach((match) => {
      const existing = rounds.get(match.round || '');
      if (existing) existing.push(match);
    });
    rounds.forEach((matches) => matches.sort((a, b) => (a.gameNumber || 0) - (b.gameNumber || 0)));

    const quarterfinals = rounds.get('Quarterfinal') || [];
    const semifinals = rounds.get('Semifinal') || [];
    const finals = rounds.get('Final') || [];

    return (
      <section className="space-y-3">
        <div className="overflow-x-auto pb-1">
          <div className="grid min-w-[900px] grid-cols-[288px_264px_264px] gap-5">
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 text-center">Quarterfinals</div>
              <div className="space-y-4">
                {quarterfinals.map((match) => renderMatchupCard(event.id, match, true))}
              </div>
            </div>

            <div className="space-y-3 pt-[110px]">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 text-center">Semifinals</div>
              <div className="space-y-[72px]">
                {semifinals.map((match) => renderMatchupCard(event.id, match, true))}
              </div>
            </div>

            <div className="space-y-3 pt-[220px]">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 text-center">Final</div>
              <div>
                {finals.map((match) => renderMatchupCard(event.id, match, true))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderAggregateParticipants = (event: typeof dayEvents[number]) => {
    const betItem = getEventBetItem(event.id);
    const totalPot = betItem ? getBetItemPot(betItem.id) : 0;

    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Participants</h4>
          {betItem ? (
            <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">
              Total Pot <span className="text-emerald-300">${totalPot.toFixed(2)}</span>
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {state.teams.map((team) => {
            const members = team.playerIds
              .map((playerId) => getSchedulePlayerName(state.players.find((player) => player.id === playerId)?.name || 'Unknown'))
              .filter(Boolean);
            const isWinner = event.status === EventStatus.COMPLETE && ((event.winnerTeamIds || []).includes(team.id) || event.winnerTeamId === team.id);
            const isLoser = event.status === EventStatus.COMPLETE && !isWinner;
            const oddsStat = getBetOptionStat(betItem, team.id);

            return (
              <div
                key={team.id}
                className={`rounded-2xl bg-[linear-gradient(145deg,rgba(15,23,42,0.24)_0%,rgba(2,6,23,0.16)_100%)] p-3 ring-1 ring-inset ring-white/[0.04] ${isLoser ? 'opacity-20 saturate-[0.1] grayscale' : ''}`}
              >
                <div
                  className="relative rounded-xl px-3 py-3 text-center text-white ring-1 ring-inset ring-white/[0.06]"
                  style={{
                    background: isWinner
                      ? `linear-gradient(145deg, ${team.colorHex}FF 0%, ${team.colorHex}D8 54%, rgba(15,23,42,0.54) 100%)`
                      : `linear-gradient(145deg, ${team.colorHex}C8 0%, ${team.colorHex}82 50%, rgba(15,23,42,0.78) 100%)`,
                    boxShadow: isWinner
                      ? `inset 0 0 0 2px #86efac, inset 0 1px 0 rgba(255,255,255,0.22), 0 0 24px rgba(34,197,94,0.28), 0 12px 26px ${team.colorHex}40`
                      : `inset 0 0 0 1px ${team.colorHex}80, inset 0 1px 0 rgba(255,255,255,0.08)`
                  }}
                >
                  {isWinner ? (
                    <div className="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-300 text-[13px] font-black text-slate-950 shadow-[0_0_18px_rgba(134,239,172,0.45)]">
                      ✓
                    </div>
                  ) : null}
                  <div className="space-y-0.5 text-[13px] font-black leading-tight">
                    {members.map((member, idx) => (
                      <div key={`${team.id}-${idx}`}>{member}</div>
                    ))}
                  </div>
                  {oddsStat ? (
                    <div className={BET_STAT_CLASS}>
                      <span className="text-white/60">{oddsStat.percentage.toFixed(0)}%</span>
                      <span className="mx-1.5 text-white/25">|</span>
                      <span className="text-emerald-300/90">${oddsStat.optionPool.toFixed(0)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {event.status !== EventStatus.COMPLETE ? renderScheduleBetButton(betItem?.id) : null}
      </section>
    );
  };

  const renderStandardMatchups = (event: typeof dayEvents[number]) => {
    if (event.type === EventType.TEAM_BRACKET) {
      const semifinals = (event.matchups || []).filter((match) => match.round === 'Semifinal');
      const finals = (event.matchups || []).filter((match) => match.round === 'Final');

      return (
        <section className="space-y-3">
          <div className="overflow-x-auto pb-1">
            <div className="grid min-w-[610px] grid-cols-[288px_264px] gap-5">
              <div className="space-y-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 text-center">Semifinals</div>
                <div className="space-y-4">
                  {semifinals.map((match) => renderMatchupCard(event.id, match, true))}
                </div>
              </div>

              <div className="space-y-3 pt-[110px]">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 text-center">Final</div>
                <div>
                  {finals.map((match) => renderMatchupCard(event.id, match, true))}
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (event.type === EventType.AGGREGATE) {
      return renderAggregateParticipants(event);
    }

    return (
      <section className="space-y-2">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Matchups</h4>
        <div className="space-y-2">
          {(event.matchups || []).map((match) => renderMatchupCard(event.id, match))}
        </div>
      </section>
    );
  };

  const renderEventCard = (event: typeof dayEvents[0]) => {
    const displayEventName = event.id === 'e9' ? 'baseball - HR derby' : getDisplayEventName(event.name);
    const isOpen = openEventIds.has(event.id);
    const hasMatchups = event.type === EventType.AGGREGATE || (!!event.matchups && event.matchups.length > 0);

    return (
      <div
        key={event.id}
        ref={(node) => {
          eventCardRefs.current[event.id] = node;
        }}
        className={`group border rounded-2xl overflow-hidden transition-all ${event.status === EventStatus.COMPLETE ? (isOpen ? 'border-slate-700 bg-slate-900/55 opacity-80' : 'border-slate-800 bg-slate-900/28 opacity-70') : (isOpen ? 'border-slate-600 bg-slate-900/80' : 'border-slate-800 bg-slate-900/40')}`}
      >
        <div
          onClick={() => handleToggleEvent(event.id)}
          className="py-5 pl-3 pr-5 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-7 h-7 flex items-center justify-center shrink-0" aria-hidden="true">
                {getEventIcon(displayEventName)}
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-2xl font-black italic uppercase tracking-tight leading-none text-white break-words pr-1">{displayEventName}</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-500/80">
                  {getEventDisplayType(event.type, event.name)}
                </p>
                {event.status === EventStatus.COMPLETE && (
                  <span className="inline-flex w-fit rounded-full border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Completed
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className={`p-2 rounded-full transition-colors ${isOpen ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-400'}`}>
              <svg className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
              </div>
            </div>
          </div>
        </div>

        {isOpen && (
          <div className="px-3 pt-2 pb-6 bg-gradient-to-b from-transparent to-slate-900/20 space-y-4 animate-in fade-in duration-200">
            <div className="flex justify-center -mt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShowRules(event.name);
                }}
                className="inline-flex items-center space-x-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-200 hover:border-emerald-500/60 hover:bg-white/15 hover:text-emerald-300 transition-colors"
              >
                <Info className="w-3 h-3" />
                <span>View Rules</span>
              </button>
            </div>

            {hasMatchups && (
              event.type === EventType.PAIRED ? renderPairedBracket(event) : renderStandardMatchups(event)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={scheduleRootRef} className="animate-in fade-in duration-500">
      <div className="sticky top-0 z-40 border-b border-slate-900 bg-slate-950/95 px-3 py-4 backdrop-blur-md">
        <div className="relative grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-900/75 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <button
            onClick={() => handleDayChange(1)}
            className={`relative z-10 rounded-xl py-4 text-[12px] font-black uppercase tracking-[0.14em] transition-all ${activeDay === 1 ? 'bg-white text-black shadow-lg' : 'text-slate-500'}`}
          >
            Day 1
          </button>
          <button
            onClick={() => handleDayChange(2)}
            className={`relative z-10 rounded-xl py-4 text-[12px] font-black uppercase tracking-[0.14em] transition-all ${activeDay === 2 ? 'bg-white text-black shadow-lg' : 'text-slate-500'}`}
          >
            Day 2
          </button>
        </div>
      </div>

      <div className="px-3 py-4 space-y-8">
        {upcomingEvents.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Upcoming Events</h2>
            <div className="space-y-3">
              {upcomingEvents.map(renderEventCard)}
            </div>
          </div>
        )}

        {completedEvents.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Past Events</h2>
            <div className="space-y-3">
              {completedEvents.map(renderEventCard)}
            </div>
          </div>
        )}
      </div>

      {!readOnly && activeBetItemId && (() => {
        const item = state.bettableItems.find((entry) => entry.id === activeBetItemId);
        const event = state.events.find((entry) => entry.id === item?.eventId);
        if (!item || !event) return null;

        return (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/82 px-4 backdrop-blur-sm" onClick={() => setActiveBetItemId(null)}>
            <div
              className="w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveBetItemId(null)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-2xl font-black leading-none text-slate-200 shadow-xl transition-colors hover:border-white/30 hover:text-white"
                  aria-label="Close bet popup"
                >
                  ×
                </button>
              </div>
              <div className="rounded-[24px] border border-slate-700 bg-slate-950 p-4 shadow-2xl">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-400">Place Bet</div>
                    <div className="mt-1 text-xl font-black italic uppercase leading-tight text-white">{event.name}</div>
                    <div className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{formatBetLabel(event.name, item.label)}</div>
                  </div>
                  <div className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-400">
                    Pot ${getBetItemPot(item.id).toFixed(2)}
                  </div>
                </div>

                <BettingPanel itemId={item.id} minimal alwaysOpen pickerTitle="Choose Winner" onBetPlaced={() => setActiveBetItemId(null)} />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Schedule;

