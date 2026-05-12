import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { TournamentState, Player, Team, Event, BettableItem, Bet, EventStatus, Matchup, EventType } from './types';
import { PLAYER_DEFS, TEAMS_INIT, EVENTS_DATA } from './constants';
import { commitRemoteTournamentState, isBackendEnabled, loadRemoteTournamentState, seedRemoteTournamentState } from './backend';

interface TournamentContextType {
  state: TournamentState;
  currentUser: Player | null;
  setCurrentUser: (user: Player | null) => void;
  loginPlayer: (playerId: string, pin: string) => Promise<{ ok: boolean; error?: string }>;
  placeBet: (playerId: string, bettableItemId: string, optionId: string, amount: number) => Promise<boolean>;
  settleItem: (itemId: string, winnerOptionId: string, winningPlayerIds?: string[]) => Promise<void>;
  updateTeams: (teams: Team[]) => Promise<void>;
  addFunds: (playerId: string, amount: number) => Promise<void>;
  adjustBankroll: (playerId: string, amount: number) => Promise<void>;
  resetPlayerPin: (playerId: string) => Promise<void>;
  setEventVisibility: (eventId: string, isVisible: boolean) => Promise<void>;
  setEventDay: (eventId: string, day: 1 | 2) => Promise<void>;
  saveSportsSettings: (settings: { id: string; day: 1 | 2; isVisible: boolean }[]) => Promise<void>;
  setEventBettingLocked: (eventId: string, bettingLocked: boolean) => Promise<void>;
  saveMatchupSettings: (settings: { eventId: string; matchups: { matchupId: string; sides: { teamId: string; playerIds: string[] }[] }[] }[]) => Promise<void>;
  voidEventBets: (eventId: string) => Promise<void>;
  resetTournament: () => Promise<void>;
  isLoading: boolean;
  refresh: () => void;
}

interface PairEntry {
  id: string;
  label: string;
  teamId: string;
  players: string[];
}

type PairedOpeningMatchups = [[string, string], [string, string]];
type TeamPairingPlan = Record<string, [string[], string[]]>;
type PairedEventPlan = {
  openingMatchups: PairedOpeningMatchups;
  teamPairings: TeamPairingPlan;
};

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

const STORAGE_KEY = 'hawken_games_v5';
const LEGACY_STORAGE_KEY = 'hawken_games_v2';
const BANKROLL_MODEL_KEY = 'hawken_games_bankroll_buyin_v1';
const PAIRED_LAYOUT_MODEL_KEY = 'hawken_games_paired_layout_v3';
const ACTIVE_ROSTER_MODEL_KEY = 'hawken_games_active_roster_no_sam_v1';
const REMOVED_EVENT_IDS = new Set<string>();
const INITIAL_BALANCE = 0;
const FINAL_TEAM_PLAYER_IDS: Record<string, string[]> = {
  t1: ['p0', 'p5', 'p10', 'p7'],
  t2: ['p8', 'p9', 'p12', 'p6'],
  t3: ['p1', 'p14', 'p2', 'p17'],
  t4: ['p3', 'p11', 'p4', 'p15']
};

const getPairEntryTeamId = (pairEntryId: string) => pairEntryId.split('-pair-')[0] || pairEntryId;
const getCombinedTeamIds = (combinedId: string) => combinedId.split('+').filter(Boolean);

const createPlayers = (): Player[] => PLAYER_DEFS.map(({ id, name }) => ({
  id,
  name,
  pin: '',
  balance: INITIAL_BALANCE
}));

const createDefaultTeams = (): Team[] => TEAMS_INIT.map((team) => ({
  ...team,
  playerIds: [...(FINAL_TEAM_PLAYER_IDS[team.id] || [])]
}));

const createShuffler = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const PAIRED_EVENT_MATCHUP_PATTERNS = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]]
] as const;

const createPairKey = (leftId: string, rightId: string) => [leftId, rightId].sort().join('|');

const getFourPlayerPairingPatterns = (playerIds: string[]): [string[], string[]][] => [
  [[playerIds[0], playerIds[1]], [playerIds[2], playerIds[3]]],
  [[playerIds[0], playerIds[2]], [playerIds[1], playerIds[3]]],
  [[playerIds[0], playerIds[3]], [playerIds[1], playerIds[2]]]
];

const getCandidatePairingCombos = (playerIds: string[]) => {
  const combos: [string[], string[]][] = [];

  for (let a = 0; a < playerIds.length; a++) {
    for (let b = a + 1; b < playerIds.length; b++) {
      for (let c = 0; c < playerIds.length; c++) {
        if (c === a || c === b) continue;
        for (let d = c + 1; d < playerIds.length; d++) {
          if (d === a || d === b) continue;
          combos.push([[playerIds[a], playerIds[b]], [playerIds[c], playerIds[d]]]);
        }
      }
    }
  }

  const seen = new Set<string>();
  return combos.filter(([left, right]) => {
    const key = [createPairKey(left[0], left[1]), createPairKey(right[0], right[1])].sort().join('/');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const createDailyTeamPairings = (playerIds: string[], eventCount: number): [string[], string[]][] => {
  if (playerIds.length < 4) {
    return Array.from({ length: eventCount }, () => [playerIds.slice(0, 2), playerIds.slice(2, 4)] as [string[], string[]]);
  }

  if (playerIds.length === 4) {
    const patterns = createShuffler(getFourPlayerPairingPatterns(createShuffler(playerIds)));
    return Array.from({ length: eventCount }, (_, index) => patterns[index % patterns.length]);
  }

  const usedPairs = new Set<string>();
  const participationCounts = new Map(playerIds.map((playerId) => [playerId, 0]));
  const pairings: [string[], string[]][] = [];

  for (let eventIndex = 0; eventIndex < eventCount; eventIndex++) {
    const candidates = createShuffler(getCandidatePairingCombos(playerIds));
    const bestCandidate = candidates
      .map((candidate) => {
        const selectedPlayers = candidate.flat();
        const newPairCount = candidate.flatMap((pair) => [createPairKey(pair[0], pair[1])]).filter((pairKey) => !usedPairs.has(pairKey)).length;
        const participationScore = selectedPlayers.reduce((acc, playerId) => acc - (participationCounts.get(playerId) || 0), 0);
        return { candidate, score: newPairCount * 100 + participationScore };
      })
      .sort((a, b) => b.score - a.score)[0]?.candidate || [playerIds.slice(0, 2), playerIds.slice(2, 4)] as [string[], string[]];

    bestCandidate.forEach((pair) => usedPairs.add(createPairKey(pair[0], pair[1])));
    bestCandidate.flat().forEach((playerId) => participationCounts.set(playerId, (participationCounts.get(playerId) || 0) + 1));
    pairings.push(bestCandidate);
  }

  return pairings;
};

const getTeamPairEntries = (eventId: string, players: Player[], teams: Team[], teamPairings?: TeamPairingPlan): PairEntry[] => {
  const orderedTeamIds = ['t1', 't2', 't3', 't4'];

  return orderedTeamIds.flatMap((teamId) => {
    const team = teams.find((entry) => entry.id === teamId);
    if (!team) return [];

    const plannedPairs = teamPairings?.[team.id] || createDailyTeamPairings(team.playerIds, 1)[0];
    const pairAPlayers = plannedPairs[0].map((playerId) => players.find((player) => player.id === playerId)?.name || 'Unknown');
    const pairBPlayers = plannedPairs[1].map((playerId) => players.find((player) => player.id === playerId)?.name || 'Unknown');

    return [
      {
        id: `${team.id}-pair-${eventId}-a`,
        label: `${team.name} A`,
        teamId: team.id,
        players: pairAPlayers.length > 0 ? pairAPlayers : ['TBD', 'TBD']
      },
      {
        id: `${team.id}-pair-${eventId}-b`,
        label: `${team.name} B`,
        teamId: team.id,
        players: pairBPlayers.length > 0 ? pairBPlayers : ['TBD', 'TBD']
      }
    ];
  });
};

const buildPairOptions = (matchup: Matchup) => {
  const showTeamOnly = matchup.round === 'Semifinal' || matchup.round === 'Final';

  return (matchup.participantIds || []).map((participantId, index) => ({
    id: participantId,
    label: showTeamOnly
      ? (matchup.participants[index] || 'TBD')
      : `${matchup.participants[index]}: ${(matchup.participantPlayers?.[index] || []).join(' & ')}`
  }));
};

const buildMatchupOptions = (matchup: Matchup) => {
  return (matchup.participantIds || []).map((participantId, index) => ({
    id: participantId,
    label: matchup.participants[index] || 'TBD'
  }));
};

const getPlayerNamesByIds = (players: Player[], playerIds: string[]) => playerIds.map((playerId) => players.find((player) => player.id === playerId)?.name || 'Unknown');

const getTeamName = (teams: Team[], teamId: string) => teams.find((team) => team.id === teamId)?.name || 'TBD';

const isOpeningRoundMatchup = (eventType: EventType, matchup: Matchup) =>
  (eventType === EventType.PAIRED && matchup.round === 'Quarterfinal') ||
  (eventType === EventType.TEAM_BRACKET && matchup.round === 'Semifinal');

const getDefaultBettingLockedForMatchup = (eventType: EventType, matchup: Matchup, readyParticipants = true) => {
  if (!readyParticipants) return true;
  if (eventType === EventType.PAIRED && matchup.round === 'Semifinal') return true;
  if (eventType === EventType.PAIRED && matchup.round === 'Final') return false;
  return false;
};

const createPairedEventPlans = (pairedEvents: { id: string; day: 1 | 2 }[], teams: Team[]) => {
  const plans = new Map<string, PairedEventPlan>();
  const teamIds = teams.map((team) => team.id);

  ([1, 2] as const).forEach((day) => {
    const dayEvents = pairedEvents.filter((event) => event.day === day);
    const shuffledPatterns = createShuffler(PAIRED_EVENT_MATCHUP_PATTERNS.map((pattern) => pattern.map((pairing) => [...pairing] as [number, number])));
    const dailyPairingsByTeam = new Map(
      teams.map((team) => [team.id, createDailyTeamPairings(team.playerIds, dayEvents.length)])
    );

    dayEvents.forEach((event, index) => {
      const pattern = shuffledPatterns[index % shuffledPatterns.length];
      const teamPairings = teams.reduce<TeamPairingPlan>((acc, team) => {
        acc[team.id] = dailyPairingsByTeam.get(team.id)?.[index] || createDailyTeamPairings(team.playerIds, 1)[0];
        return acc;
      }, {});

      plans.set(event.id, {
        openingMatchups: [
          [teamIds[pattern[0][0]], teamIds[pattern[0][1]]],
          [teamIds[pattern[1][0]], teamIds[pattern[1][1]]]
        ],
        teamPairings
      });
    });
  });

  return plans;
};

const createPairedBracket = (eventId: string, players: Player[], teams: Team[], plan?: PairedEventPlan): Matchup[] => {
  const pairEntries = getTeamPairEntries(eventId, players, teams, plan?.teamPairings);
  const pairLookup = new Map(pairEntries.map((entry) => [entry.id, entry]));
  const getPair = (pairId: string) => pairLookup.get(pairId)!;
  const fallbackTeams = teams.map((team) => team.id);
  const [firstMatchup = [fallbackTeams[0], fallbackTeams[1]], secondMatchup = [fallbackTeams[2], fallbackTeams[3]]] = plan?.openingMatchups || [
    [fallbackTeams[0], fallbackTeams[1]],
    [fallbackTeams[2], fallbackTeams[3]]
  ];

  const buildQuarterfinalGames = (teamAId: string, teamBId: string) => {
    const teamAPairs = createShuffler([getPair(`${teamAId}-pair-${eventId}-a`), getPair(`${teamAId}-pair-${eventId}-b`)]);
    const teamBPairs = createShuffler([getPair(`${teamBId}-pair-${eventId}-a`), getPair(`${teamBId}-pair-${eventId}-b`)]);
    const useCrossedPairs = Math.random() >= 0.5;

    return useCrossedPairs
      ? [
          [teamAPairs[0], teamBPairs[1]],
          [teamAPairs[1], teamBPairs[0]]
        ]
      : [
          [teamAPairs[0], teamBPairs[0]],
          [teamAPairs[1], teamBPairs[1]]
        ];
  };

  const [firstQuarterfinal, secondQuarterfinal] = buildQuarterfinalGames(firstMatchup[0], firstMatchup[1]);
  const [thirdQuarterfinal, fourthQuarterfinal] = buildQuarterfinalGames(secondMatchup[0], secondMatchup[1]);

  const [g1Left, g1Right] = firstQuarterfinal;
  const [g2Left, g2Right] = secondQuarterfinal;
  const [g3Left, g3Right] = thirdQuarterfinal;
  const [g4Left, g4Right] = fourthQuarterfinal;

  return [
    { id: `${eventId}-g1`, gameNumber: 1, round: 'Quarterfinal', participants: [g1Left.label, g1Right.label], participantIds: [g1Left.id, g1Right.id], participantTeamIds: [g1Left.teamId, g1Right.teamId], participantPlayers: [g1Left.players, g1Right.players], nextMatchupId: `${eventId}-g5`, nextMatchupSlot: 0 },
    { id: `${eventId}-g2`, gameNumber: 2, round: 'Quarterfinal', participants: [g2Left.label, g2Right.label], participantIds: [g2Left.id, g2Right.id], participantTeamIds: [g2Left.teamId, g2Right.teamId], participantPlayers: [g2Left.players, g2Right.players], nextMatchupId: `${eventId}-g5`, nextMatchupSlot: 1 },
    { id: `${eventId}-g3`, gameNumber: 3, round: 'Quarterfinal', participants: [g3Left.label, g3Right.label], participantIds: [g3Left.id, g3Right.id], participantTeamIds: [g3Left.teamId, g3Right.teamId], participantPlayers: [g3Left.players, g3Right.players], nextMatchupId: `${eventId}-g6`, nextMatchupSlot: 0 },
    { id: `${eventId}-g4`, gameNumber: 4, round: 'Quarterfinal', participants: [g4Left.label, g4Right.label], participantIds: [g4Left.id, g4Right.id], participantTeamIds: [g4Left.teamId, g4Right.teamId], participantPlayers: [g4Left.players, g4Right.players], nextMatchupId: `${eventId}-g6`, nextMatchupSlot: 1 },
    { id: `${eventId}-g5`, gameNumber: 5, round: 'Semifinal', participants: ['TBD', 'TBD'], participantIds: ['', ''], participantTeamIds: ['', ''], participantPlayers: [[], []], nextMatchupId: `${eventId}-g7`, nextMatchupSlot: 0 },
    { id: `${eventId}-g6`, gameNumber: 6, round: 'Semifinal', participants: ['TBD', 'TBD'], participantIds: ['', ''], participantTeamIds: ['', ''], participantPlayers: [[], []], nextMatchupId: `${eventId}-g7`, nextMatchupSlot: 1 },
    { id: `${eventId}-g7`, gameNumber: 7, round: 'Final', participants: ['TBD', 'TBD'], participantIds: ['', ''], participantTeamIds: ['', ''], participantPlayers: [[], []] }
  ];
};

const createCombinedTeamMatchup = (eventId: string, players: Player[], teams: Team[]): Matchup[] => {
  const shuffledTeamIds = createShuffler(teams.map((team) => team.id));
  const sideAIds = shuffledTeamIds.slice(0, 2);
  const sideBIds = shuffledTeamIds.slice(2, 4);

  const getSideLabel = (teamIds: string[]) => teamIds.map((teamId) => teams.find((team) => team.id === teamId)?.name || 'Team').join(' + ');
  const getSidePlayers = (teamIds: string[]) => teamIds.flatMap((teamId) => {
    const team = teams.find((entry) => entry.id === teamId);
    if (!team) return [];
    return team.playerIds.map((playerId) => players.find((player) => player.id === playerId)?.name || 'Unknown');
  });

  return [
    {
      id: `${eventId}-g1`,
      gameNumber: 1,
      round: 'Matchup',
      participants: [getSideLabel(sideAIds), getSideLabel(sideBIds)],
      participantIds: [sideAIds.join('+'), sideBIds.join('+')],
      participantTeamIds: [sideAIds.join('+'), sideBIds.join('+')],
      participantPlayers: [getSidePlayers(sideAIds), getSidePlayers(sideBIds)]
    }
  ];
};

const buildTournamentData = (players: Player[], teams: Team[]) => {
  const items: BettableItem[] = [];
  const pairedEvents = EVENTS_DATA
    .filter((event) => event.type === EventType.PAIRED)
    .map((event) => ({ id: event.id, day: event.day }));
  const pairedEventPlans = createPairedEventPlans(pairedEvents, teams);
  const events: Event[] = EVENTS_DATA.map((eventData) => {
    const teamIds = teams.map(team => team.id);
    const shuffledTeams = createShuffler(teamIds);

    let matchups: Matchup[] = [];
    if (eventData.type === EventType.PAIRED) {
      matchups = createPairedBracket(eventData.id, players, teams, pairedEventPlans.get(eventData.id));
    } else if (eventData.type === EventType.TEAM_BRACKET) {
      matchups = [
        { id: `${eventData.id}-m1`, gameNumber: 1, round: 'Semifinal', participants: [shuffledTeams[0], shuffledTeams[1]], participantIds: [shuffledTeams[0], shuffledTeams[1]], participantTeamIds: [shuffledTeams[0], shuffledTeams[1]], nextMatchupId: `${eventData.id}-final`, nextMatchupSlot: 0 },
        { id: `${eventData.id}-m2`, gameNumber: 2, round: 'Semifinal', participants: [shuffledTeams[2], shuffledTeams[3]], participantIds: [shuffledTeams[2], shuffledTeams[3]], participantTeamIds: [shuffledTeams[2], shuffledTeams[3]], nextMatchupId: `${eventData.id}-final`, nextMatchupSlot: 1 },
        { id: `${eventData.id}-final`, gameNumber: 3, round: 'Final', participants: ['TBD', 'TBD'], participantIds: ['', ''], participantTeamIds: ['', ''] }
      ];
    } else if (eventData.type === EventType.COMBINED_TEAM) {
      matchups = createCombinedTeamMatchup(eventData.id, players, teams);
    }

    const itemIds = (() => {
      if (eventData.type === EventType.PAIRED) {
        return matchups.map((matchup) => {
          const id = `item-${eventData.id}-${matchup.gameNumber}`;
          const readyParticipants = matchup.round === 'Quarterfinal';
          items.push({
            id,
            eventId: eventData.id,
            label: `Game ${matchup.gameNumber}`,
            options: readyParticipants ? buildPairOptions(matchup) : [],
            status: readyParticipants ? 'OPEN' : 'LOCKED',
            bettingLocked: getDefaultBettingLockedForMatchup(eventData.type, matchup, readyParticipants),
            day: eventData.day as 1 | 2,
            matchupId: matchup.id
          });
          return id;
        });
      }

      if (eventData.type === EventType.TEAM_BRACKET) {
        return matchups.map((matchup, index) => {
          const id = `item-${eventData.id}-${index}`;
          const options = buildMatchupOptions(matchup);
          const label = matchup.gameNumber === 3 ? 'Championship Final Winner' : `Game ${matchup.gameNumber}`;
          const readyParticipants = (matchup.participantIds || []).filter(Boolean).length === 2 && !(matchup.participantIds || []).includes('');
          items.push({ id, eventId: eventData.id, label, options: readyParticipants ? options : [], status: matchup.round === 'Semifinal' ? 'OPEN' : 'LOCKED', day: eventData.day as 1 | 2, matchupId: matchup.id });
          return id;
        });
      }

      if (eventData.type === EventType.COMBINED_TEAM) {
        return matchups.map((matchup) => {
          const id = `item-${eventData.id}-0`;
          items.push({ id, eventId: eventData.id, label: 'Game 1', options: buildMatchupOptions(matchup), status: 'OPEN', day: eventData.day as 1 | 2, matchupId: matchup.id });
          return id;
        });
      }

      return eventData.items.map((label, index) => {
        const id = `item-${eventData.id}-${index}`;
        items.push({ id, eventId: eventData.id, label, options: teams.map((team) => ({ id: team.id, label: team.name })), status: 'OPEN', day: eventData.day as 1 | 2 });
        return id;
      });
    })();

    return {
      id: eventData.id,
      name: eventData.name,
      day: eventData.day as 1 | 2,
      type: eventData.type,
      status: EventStatus.UPCOMING,
      isVisible: eventData.isVisible ?? true,
      winnerTeamId: undefined,
      winnerTeamIds: undefined,
      bettableItemIds: itemIds,
      matchups
    };
  });

  return { events, bettableItems: items };
};

const createInitialState = (players: Player[], teams: Team[]): TournamentState => {
  const { events, bettableItems } = buildTournamentData(players, teams);
  return { players, teams, events, bettableItems, bets: [] };
};

const requiresFormatMigration = (savedState: TournamentState) => {
  const pairedLegacy = (savedState.events || []).some((event) => {
    if (event.type !== EventType.PAIRED) return false;
    const pairedItems = (savedState.bettableItems || []).filter((item) => item.eventId === event.id);
    const hasLegacyItems = pairedItems.some((item) => item.label.includes('Group Game') || item.label.includes('Championship Final'));
    const hasLegacyRounds = (event.matchups || []).some((matchup) => matchup.round === 'Group Stage' || matchup.round === 'Championship Final');
    return pairedItems.length !== 7 || hasLegacyItems || hasLegacyRounds;
  });

  const baseballLegacy = (savedState.events || []).some((event) => event.id === 'e10' && event.type !== EventType.COMBINED_TEAM);

  return pairedLegacy || baseballLegacy;
};

const getLegacyPinMap = () => {
  if (typeof window === 'undefined') return new Map<string, string>();

  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw) return new Map<string, string>();

  try {
    const legacyState = JSON.parse(legacyRaw) as TournamentState;
    return new Map(
      (legacyState.players || [])
        .filter((player) => player.pin)
        .map((player) => [player.id, player.pin])
    );
  } catch {
    return new Map<string, string>();
  }
};

const normalizeState = (savedState: TournamentState): TournamentState => {
  const legacyPinMap = getLegacyPinMap();
  const playerMap = new Map((savedState.players || []).map((player) => [player.id, { ...player, pin: player.pin || legacyPinMap.get(player.id) || '' }]));
  PLAYER_DEFS.forEach(({ id: playerId, name }) => {
    const existingPlayer = playerMap.get(playerId);
    playerMap.set(playerId, existingPlayer
      ? { ...existingPlayer, name }
      : { id: playerId, name, pin: legacyPinMap.get(playerId) || '', balance: INITIAL_BALANCE });
  });
  const activePlayerIds = new Set<string>(PLAYER_DEFS.map((player) => player.id));
  const players = Array.from(playerMap.values())
    .filter((player) => activePlayerIds.has(player.id))
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  const teams = TEAMS_INIT.map((team) => ({ ...team, playerIds: [...(FINAL_TEAM_PLAYER_IDS[team.id] || [])] }));

  const savedRosterSignature = JSON.stringify((savedState.teams || []).map((team) => ({ id: team.id, playerIds: team.playerIds })));
  const finalRosterSignature = JSON.stringify(teams.map((team) => ({ id: team.id, playerIds: team.playerIds })));

  if (requiresFormatMigration(savedState) || savedRosterSignature !== finalRosterSignature) {
    return createInitialState(players, teams);
  }

  const baselineState = createInitialState(players, teams);
  const savedEvents = (savedState.events || [])
    .filter((event) => !REMOVED_EVENT_IDS.has(event.id))
    .map((event) => ({
      ...event,
      isVisible: event.isVisible ?? true,
      bettingLocked: event.bettingLocked ?? false
    }));
  const savedEventMap = new Map(savedEvents.map((event) => [event.id, event]));
  const events = baselineState.events.map((event) => savedEventMap.get(event.id) || event);

  const validEventIds = new Set(events.map((event) => event.id));
  const savedItems = (savedState.bettableItems || [])
    .filter((item) => validEventIds.has(item.eventId));
  const savedItemMap = new Map(savedItems.map((item) => [item.id, item]));
  const bettableItems = baselineState.bettableItems.map((item) => {
    const savedItem = savedItemMap.get(item.id);
    if (!savedItem) return item;
    const event = events.find((entry) => entry.id === savedItem.eventId);
    const matchup = event?.matchups?.find((entry) => entry.id === savedItem.matchupId);
    const readyParticipants = (matchup?.participantIds || []).filter(Boolean).length === 2 && !(matchup?.participantIds || []).includes('');
    const forcedTournamentLock = event && matchup && event.type === EventType.PAIRED
      ? getDefaultBettingLockedForMatchup(event.type, matchup, readyParticipants)
      : false;
    return { ...savedItem, bettingLocked: savedItem.status !== 'SETTLED' ? forcedTournamentLock || (savedItem.bettingLocked ?? false) : savedItem.bettingLocked };
  });

  const validBettableItemIds = new Set(bettableItems.map((item) => item.id));
  const bets = (savedState.bets || []).filter((bet) => validBettableItemIds.has(bet.bettableItemId));

  return { ...savedState, players, teams, events, bettableItems, bets };
};

const migrateBankrollModel = (savedState: TournamentState): TournamentState => ({
  ...savedState,
  players: (savedState.players || []).map((player) => ({ ...player, balance: INITIAL_BALANCE })),
  bets: []
});

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TournamentState>({ players: [], teams: [], events: [], bettableItems: [], bets: [] });
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const remoteRevisionRef = useRef<number | null>(null);
  const stateRef = useRef<TournamentState>(state);
  const currentUserRef = useRef<Player | null>(currentUser);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const applyTournamentState = useCallback((nextState: TournamentState) => {
    stateRef.current = nextState;
    setState(nextState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));

    const activeUser = currentUserRef.current;
    if (activeUser) {
      const updatedUser = nextState.players.find((player) => player.id === activeUser.id) || null;
      currentUserRef.current = updatedUser;
      setCurrentUser(updatedUser);
      if (updatedUser) {
        localStorage.setItem('hawken_user', JSON.stringify(updatedUser));
      } else {
        localStorage.removeItem('hawken_user');
      }
    }
  }, []);

  const refreshRemoteState = useCallback(async (options: { force?: boolean } = {}) => {
    if (!isBackendEnabled) return stateRef.current;

    const remoteState = await loadRemoteTournamentState();
    if (!remoteState) return stateRef.current;

    const shouldApply = options.force || remoteRevisionRef.current === null || remoteState.revision > remoteRevisionRef.current;
    if (!shouldApply) return stateRef.current;

    const normalizedState = normalizeState(remoteState.state);
    remoteRevisionRef.current = remoteState.revision;
    applyTournamentState(normalizedState);
    return normalizedState;
  }, [applyTournamentState]);

  const init = useCallback(async () => {
    setIsLoading(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    let activeState: TournamentState;

    if (saved) {
      const parsedState = JSON.parse(saved) as TournamentState;
      let nextState = normalizeState(parsedState);
      if (localStorage.getItem(BANKROLL_MODEL_KEY) !== 'ready') {
        nextState = migrateBankrollModel(nextState);
        localStorage.setItem(BANKROLL_MODEL_KEY, 'ready');
      }
      if (localStorage.getItem(PAIRED_LAYOUT_MODEL_KEY) !== 'ready') {
        nextState = createInitialState(nextState.players, nextState.teams);
        localStorage.setItem(PAIRED_LAYOUT_MODEL_KEY, 'ready');
      }
      if (localStorage.getItem(ACTIVE_ROSTER_MODEL_KEY) !== 'ready') {
        nextState = createInitialState(nextState.players.map((player) => ({ ...player, balance: INITIAL_BALANCE })), nextState.teams);
        localStorage.setItem(ACTIVE_ROSTER_MODEL_KEY, 'ready');
      }
      activeState = nextState;
      setState(nextState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } else {
      const players = createPlayers();
      const teams = createDefaultTeams();
      const initialState = createInitialState(players, teams);
      activeState = initialState;
      setState(initialState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
      localStorage.setItem(BANKROLL_MODEL_KEY, 'ready');
      localStorage.setItem(PAIRED_LAYOUT_MODEL_KEY, 'ready');
      localStorage.setItem(ACTIVE_ROSTER_MODEL_KEY, 'ready');
    }

    if (isBackendEnabled) {
      try {
        const remoteState = await loadRemoteTournamentState();

        if (remoteState) {
          const normalizedRemoteState = normalizeState(remoteState.state);
          const remoteNeedsRosterReset = (remoteState.state.players || []).some((player) => player.id === 'p16' || player.name === 'Sam')
            || (remoteState.state.teams || []).some((team) => team.playerIds.includes('p16'));

          if (remoteNeedsRosterReset) {
            const resetState = createInitialState(
              normalizedRemoteState.players.map((player) => ({ ...player, balance: INITIAL_BALANCE })),
              normalizedRemoteState.teams
            );
            const committedState = await commitRemoteTournamentState(resetState, remoteState.revision);
            activeState = normalizeState(committedState.state);
            remoteRevisionRef.current = committedState.revision;
          } else {
            activeState = normalizedRemoteState;
            remoteRevisionRef.current = remoteState.revision;
          }
        } else {
          const seededState = await seedRemoteTournamentState(activeState);
          activeState = normalizeState(seededState.state);
          remoteRevisionRef.current = seededState.revision;
        }

        setState(activeState);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(activeState));
      } catch (error) {
        console.warn('Supabase load failed. Falling back to local state.', error);
      }
    }

    const savedUser = localStorage.getItem('hawken_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser) as Player;
      const freshUser = activeState.players.find((player) => player.id === parsedUser.id) || null;

      if (!freshUser?.pin || freshUser.pin !== parsedUser.pin) {
        setCurrentUser(null);
        localStorage.removeItem('hawken_user');
      } else {
        setCurrentUser(freshUser);
        localStorage.setItem('hawken_user', JSON.stringify(freshUser));
      }
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!isBackendEnabled || isLoading) return undefined;

    const pollLatestState = () => {
      refreshRemoteState().catch((error) => {
        console.warn('Live state refresh failed.', error);
      });
    };

    const intervalId = window.setInterval(pollLatestState, 2000);
    window.addEventListener('focus', pollLatestState);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', pollLatestState);
    };
  }, [isLoading, refreshRemoteState]);

  const refresh = () => {
    init();
  };

  const saveState = async (newState: TournamentState): Promise<TournamentState> => {
    stateRef.current = newState;
    setState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));

    if (currentUser) {
      const updatedUser = newState.players.find((player) => player.id === currentUser.id) || null;
      setCurrentUser(updatedUser);
      if (updatedUser) localStorage.setItem('hawken_user', JSON.stringify(updatedUser));
    }

    if (isBackendEnabled && remoteRevisionRef.current !== null) {
      try {
        const committedState = await commitRemoteTournamentState(newState, remoteRevisionRef.current);
        const normalizedState = normalizeState(committedState.state);
        remoteRevisionRef.current = committedState.revision;
        stateRef.current = normalizedState;
        setState(normalizedState);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedState));

        if (currentUser) {
          const updatedUser = normalizedState.players.find((player) => player.id === currentUser.id) || null;
          setCurrentUser(updatedUser);
          if (updatedUser) localStorage.setItem('hawken_user', JSON.stringify(updatedUser));
        }

        return normalizedState;
      } catch (error) {
        console.warn('Supabase save failed.', error);
        window.alert('The shared tournament data changed before this save finished. Refresh and try again.');
        throw error;
      }
    }

    return newState;
  };

  const placeBet = async (playerId: string, itemId: string, optionId: string, amount: number) => {
    const latestState = await refreshRemoteState({ force: true });
    const item = latestState.bettableItems.find((entry) => entry.id === itemId);
    if (!item || item.status !== 'OPEN' || item.bettingLocked) return false;

    const players = latestState.players.map((player) => ({ ...player }));
    const bets = latestState.bets.map((bet) => ({ ...bet }));
    const player = players.find((entry) => entry.id === playerId);
    if (!player) return false;

    const existingBetIndex = bets.findIndex((bet) => bet.playerId === playerId && bet.bettableItemId === itemId && !bet.refunded && !bet.voided);
    if (existingBetIndex > -1) {
      return false;
    }

    if (player.balance < amount) return false;

    player.balance -= amount;
    bets.push({
      id: `bet-${Date.now()}`,
      playerId,
      bettableItemId: itemId,
      optionId,
      amount,
      timestamp: Date.now()
    });

    await saveState({
      ...latestState,
      players,
      bets
    });
    return true;
  };

  const loginPlayer = async (playerId: string, pin: string) => {
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player) return { ok: false, error: 'Player not found' };
    if (pin.length !== 4) return { ok: false, error: 'PIN must be 4 digits' };
    if (player.pin && player.pin !== pin) return { ok: false, error: 'Incorrect PIN' };

    const players = state.players.map((entry) => (
      entry.id === playerId ? { ...entry, pin: entry.pin || pin } : entry
    ));
    const updatedPlayer = players.find((entry) => entry.id === playerId) || null;
    if (!updatedPlayer) return { ok: false, error: 'Player not found' };

    const confirmedState = await saveState({ ...state, players });
    const confirmedUser = confirmedState.players.find((entry) => entry.id === playerId) || updatedPlayer;
    setCurrentUser(confirmedUser);
    localStorage.setItem('hawken_user', JSON.stringify(confirmedUser));
    return { ok: true };
  };

  const settleItem = async (itemId: string, winnerOptionId: string, winningPlayerIds: string[] = []) => {
    const newState = { ...state };
    const item = newState.bettableItems.find(i => i.id === itemId);
    if (!item || item.status === 'SETTLED') return;

    item.winnerOptionId = winnerOptionId;
    item.status = 'SETTLED';

    const itemBets = newState.bets.filter(b => b.bettableItemId === itemId);
    const totalPool = itemBets.reduce((acc, b) => acc + b.amount, 0);
    const winningPool = itemBets.filter(b => b.optionId === winnerOptionId).reduce((acc, b) => acc + b.amount, 0);
    const uniqueSidesBetOn = new Set(itemBets.map((bet) => bet.optionId));
    const isRefundOnlyMarket = itemBets.length > 0 && uniqueSidesBetOn.size <= 1;

    if (isRefundOnlyMarket) {
      itemBets.forEach((bet) => {
        const player = newState.players.find((p) => p.id === bet.playerId);
        if (player) {
          player.balance += bet.amount;
          bet.payout = bet.amount;
          bet.refunded = true;
          bet.voided = true;
        }
      });
    } else if (winningPool > 0) {
      itemBets.forEach(bet => {
        if (bet.optionId === winnerOptionId) {
          const share = bet.amount / winningPool;
          const payout = share * totalPool;
          const player = newState.players.find(p => p.id === bet.playerId);
          if (player) {
            player.balance += payout;
            bet.payout = payout;
            bet.refunded = false;
            bet.voided = false;
          }
        } else {
          bet.payout = 0;
          bet.refunded = false;
          bet.voided = false;
        }
      });
    }

    const event = newState.events.find(e => e.id === item.eventId);
    if (event && event.matchups && item.matchupId) {
      const settledMatchup = event.matchups.find((matchup) => matchup.id === item.matchupId);
      if (settledMatchup) {
        const winnerIndex = settledMatchup.participantIds?.findIndex((participantId) => participantId === winnerOptionId) ?? -1;
        const winnerTeamId = event.type === EventType.PAIRED ? getPairEntryTeamId(winnerOptionId) : winnerOptionId;

        settledMatchup.winnerId = winnerOptionId;
        settledMatchup.winnerTeamId = winnerTeamId;
        settledMatchup.winningPlayerIds = event.type === EventType.AGGREGATE ? [] : [...new Set(winningPlayerIds)];

        if (winnerIndex >= 0) {
          const nextMatchup = settledMatchup.nextMatchupId ? event.matchups.find((matchup) => matchup.id === settledMatchup.nextMatchupId) : undefined;

          if (nextMatchup && settledMatchup.nextMatchupSlot !== undefined) {
            const slot = settledMatchup.nextMatchupSlot;
            nextMatchup.participants = [...(nextMatchup.participants || ['TBD', 'TBD'])];
            nextMatchup.participantIds = [...(nextMatchup.participantIds || ['', ''])];
            nextMatchup.participantTeamIds = [...(nextMatchup.participantTeamIds || ['', ''])];
            nextMatchup.participantPlayers = [...(nextMatchup.participantPlayers || [[], []])];
            nextMatchup.participants[slot] = settledMatchup.participants[winnerIndex];
            nextMatchup.participantIds[slot] = winnerOptionId;
            nextMatchup.participantTeamIds[slot] = winnerTeamId;
            nextMatchup.participantPlayers[slot] = settledMatchup.participantPlayers?.[winnerIndex] || [];

            const nextItem = newState.bettableItems.find((entry) => entry.matchupId === nextMatchup.id);
            if (nextItem) {
              const readyParticipants = (nextMatchup.participantIds || []).filter(Boolean).length === 2 && !(nextMatchup.participantIds || []).includes('');
              nextItem.options = readyParticipants
                ? (event.type === EventType.PAIRED ? buildPairOptions(nextMatchup) : buildMatchupOptions(nextMatchup))
                : [];
              if (nextItem.status !== 'SETTLED') {
                nextItem.status = readyParticipants ? 'OPEN' : 'LOCKED';
                nextItem.bettingLocked = event.type === EventType.PAIRED
                  ? getDefaultBettingLockedForMatchup(event.type, nextMatchup, readyParticipants)
                  : event.bettingLocked || nextItem.bettingLocked || false;
              }
            }
          }
        }

        if (event.type === EventType.PAIRED && settledMatchup.gameNumber === 7) {
          event.status = EventStatus.COMPLETE;
          event.winnerTeamId = winnerTeamId;
          event.winnerTeamIds = [winnerTeamId];
        }

        if (event.type === EventType.COMBINED_TEAM) {
          event.status = EventStatus.COMPLETE;
          event.winnerTeamId = winnerOptionId;
          event.winnerTeamIds = getCombinedTeamIds(winnerOptionId);
        }
      }
    }

    if (event && event.type === EventType.AGGREGATE && item.label.includes('Winner')) {
      event.status = EventStatus.COMPLETE;
      event.winnerTeamId = winnerOptionId;
      event.winnerTeamIds = [winnerOptionId];
    }

    if (event && event.type === EventType.TEAM_BRACKET && item.label.includes('Winner')) {
      event.status = EventStatus.COMPLETE;
      event.winnerTeamId = winnerOptionId;
      event.winnerTeamIds = [winnerOptionId];
    }

    await saveState(newState);
  };

  const updateTeams = async (teams: Team[]) => {
    const resetPlayers = state.players.map((player) => ({ ...player, balance: INITIAL_BALANCE }));
    const rebuiltState = createInitialState(resetPlayers, teams);
    await saveState(rebuiltState);
  };

  const resetTournament = async () => {
    if (isBackendEnabled) {
      await refreshRemoteState({ force: true });
    }

    const freshState = createInitialState(createPlayers(), createDefaultTeams());
    await saveState(freshState);
    setCurrentUser(null);
    localStorage.removeItem('hawken_user');
  };

  const addFunds = async (playerId: string, amount: number) => {
    if (!Number.isFinite(amount) || amount < 20) return;

    const newState = {
      ...state,
      players: state.players.map((player) => (
        player.id === playerId
          ? { ...player, balance: player.balance + amount }
          : player
      ))
    };

    await saveState(newState);
  };

  const setEventVisibility = async (eventId: string, isVisible: boolean) => {
    const newState = {
      ...state,
      events: state.events.map((event) => (
        event.id === eventId ? { ...event, isVisible } : event
      ))
    };

    await saveState(newState);
  };

  const setEventDay = async (eventId: string, day: 1 | 2) => {
    const newState = {
      ...state,
      events: state.events.map((event) => (
        event.id === eventId ? { ...event, day } : event
      )),
      bettableItems: state.bettableItems.map((item) => (
        item.eventId === eventId ? { ...item, day } : item
      ))
    };

    await saveState(newState);
  };

  const saveSportsSettings = async (settings: { id: string; day: 1 | 2; isVisible: boolean }[]) => {
    const settingsMap = new Map(settings.map((entry) => [entry.id, entry]));
    const newState = {
      ...state,
      events: state.events.map((event) => {
        const next = settingsMap.get(event.id);
        return next ? { ...event, day: next.day, isVisible: next.isVisible } : event;
      }),
      bettableItems: state.bettableItems.map((item) => {
        const next = settingsMap.get(item.eventId);
        return next ? { ...item, day: next.day } : item;
      })
    };

    await saveState(newState);
  };

  const setEventBettingLocked = async (eventId: string, bettingLocked: boolean) => {
    const newState = {
      ...state,
      events: state.events.map((event) => (
        event.id === eventId ? { ...event, bettingLocked } : event
      )),
      bettableItems: state.bettableItems.map((item) => {
        if (item.eventId !== eventId || item.status !== 'OPEN') return item;

        const event = state.events.find((entry) => entry.id === item.eventId);
        const matchup = event?.matchups?.find((entry) => entry.id === item.matchupId);
        const readyParticipants = (matchup?.participantIds || []).filter(Boolean).length === 2 && !(matchup?.participantIds || []).includes('');
        const forcedLock = event && matchup ? getDefaultBettingLockedForMatchup(event.type, matchup, readyParticipants) : false;

        return { ...item, bettingLocked: forcedLock || bettingLocked };
      })
    };

    await saveState(newState);
  };

  const adjustBankroll = async (playerId: string, amount: number) => {
    if (!Number.isFinite(amount) || amount === 0) return;

    const player = state.players.find((entry) => entry.id === playerId);
    if (!player) return;

    const nextBalance = player.balance + amount;
    if (nextBalance < 0) return;

    const newState = {
      ...state,
      players: state.players.map((entry) => (
        entry.id === playerId
          ? { ...entry, balance: nextBalance }
          : entry
      ))
    };

    await saveState(newState);
  };

  const resetPlayerPin = async (playerId: string) => {
    const newState = {
      ...state,
      players: state.players.map((player) => (
        player.id === playerId ? { ...player, pin: '' } : player
      ))
    };

    await saveState(newState);
  };

  const voidEventBets = async (eventId: string) => {
    const eventItemIds = new Set(state.bettableItems.filter((item) => item.eventId === eventId).map((item) => item.id));
    const hasVoidableBets = state.bets.some((bet) => eventItemIds.has(bet.bettableItemId) && !bet.refunded && !bet.voided);
    if (!hasVoidableBets) return;

    const players = state.players.map((player) => ({ ...player }));
    const bets = state.bets.map((bet) => {
      if (!eventItemIds.has(bet.bettableItemId) || bet.refunded || bet.voided) return { ...bet };

      const player = players.find((entry) => entry.id === bet.playerId);
      if (player && bet.payout === undefined) {
        player.balance += bet.amount;
      }

      return {
        ...bet,
        payout: bet.amount,
        refunded: true,
        voided: true
      };
    });

    await saveState({ ...state, players, bets });
  };

  const saveMatchupSettings = async (settings: { eventId: string; matchups: { matchupId: string; sides: { teamId: string; playerIds: string[] }[] }[] }[]) => {
    const settingsMap = new Map<string, { matchupId: string; sides: { teamId: string; playerIds: string[] }[] }[]>(settings.map((entry) => [entry.eventId, entry.matchups]));
    const hasUnvoidedBets = state.bets.some((bet) => {
      if (bet.refunded || bet.voided) return false;
      const item = state.bettableItems.find((entry) => entry.id === bet.bettableItemId);
      return !!item && settingsMap.has(item.eventId);
    });

    if (hasUnvoidedBets) return;

    const updatedEvents = state.events.map((event) => {
      const matchupSettings = settingsMap.get(event.id);
      if (!matchupSettings || !event.matchups) return event;

      const nextMatchups = event.matchups.map((matchup) => ({
        ...matchup,
        participants: [...matchup.participants],
        participantIds: [...(matchup.participantIds || [])],
        participantTeamIds: [...(matchup.participantTeamIds || [])],
        participantPlayers: (matchup.participantPlayers || []).map((players) => [...players])
      }));

      const matchupMap = new Map<string, Matchup>(nextMatchups.map((matchup) => [matchup.id, matchup]));
      matchupSettings.forEach((matchupSetting) => {
        const matchup = matchupMap.get(matchupSetting.matchupId);
        if (!matchup) return;
        matchup.participants = matchupSetting.sides.map((side) => getTeamName(state.teams, side.teamId));
        matchup.participantIds = matchupSetting.sides.map((side, index) => event.type === EventType.PAIRED ? `${side.teamId}-pair-manual-${matchup.gameNumber || 0}-${index}` : side.teamId);
        matchup.participantTeamIds = matchupSetting.sides.map((side) => side.teamId);
        matchup.participantPlayers = matchupSetting.sides.map((side) => getPlayerNamesByIds(state.players, side.playerIds));
        matchup.winnerId = undefined;
        matchup.winnerTeamId = undefined;
        matchup.winningPlayerIds = undefined;
        matchup.score = undefined;
      });

      nextMatchups.forEach((matchup) => {
        if (isOpeningRoundMatchup(event.type, matchup)) return;
        matchup.participants = ['TBD', 'TBD'];
        matchup.participantIds = ['', ''];
        matchup.participantTeamIds = ['', ''];
        matchup.participantPlayers = [[], []];
        matchup.winnerId = undefined;
        matchup.winnerTeamId = undefined;
        matchup.winningPlayerIds = undefined;
        matchup.score = undefined;
      });

      return { ...event, status: EventStatus.UPCOMING, winnerTeamId: undefined, winnerTeamIds: undefined, matchups: nextMatchups };
    });

    const updatedEventMap = new Map<string, Event>(updatedEvents.map((event) => [event.id, event]));
    const updatedItems = state.bettableItems.map((item) => {
      const event = updatedEventMap.get(item.eventId);
      if (!event || !settingsMap.has(item.eventId) || !event.matchups) return item;
      const matchup = event.matchups.find((entry) => entry.id === item.matchupId);
      if (!matchup) return { ...item, winnerOptionId: undefined };
      const readyParticipants = (matchup.participantIds || []).filter(Boolean).length === 2 && !(matchup.participantIds || []).includes('');
      const options = readyParticipants ? (event.type === EventType.PAIRED ? buildPairOptions(matchup) : buildMatchupOptions(matchup)) : [];
      const isOpening = isOpeningRoundMatchup(event.type, matchup);
      return {
        ...item,
        options,
        winnerOptionId: undefined,
        status: isOpening && readyParticipants ? 'OPEN' : 'LOCKED',
        bettingLocked: getDefaultBettingLockedForMatchup(event.type, matchup, readyParticipants) || (event.type !== EventType.PAIRED && !!event.bettingLocked)
      };
    });

    await saveState({ ...state, events: updatedEvents, bettableItems: updatedItems });
  };
  return (
    <TournamentContext.Provider value={{ state, currentUser, setCurrentUser, loginPlayer, placeBet, settleItem, updateTeams, addFunds, adjustBankroll, resetPlayerPin, setEventVisibility, setEventDay, saveSportsSettings, setEventBettingLocked, saveMatchupSettings, voidEventBets, resetTournament, isLoading, refresh }}>
      {children}
    </TournamentContext.Provider>
  );
};

export const useTournament = () => {
  const context = useContext(TournamentContext);
  if (!context) throw new Error('useTournament must be used within TournamentProvider');
  return context;
};






