import React, { useEffect, useMemo, useState } from 'react';
import { useTournament } from '../store';
import { Team, EventStatus, EventType, TournamentState, Event, BettableItem } from '../types';
import MatchupsAdmin from './MatchupsAdmin';

const MAX_TEAM_SIZE = 5;
type AdminView = 'Teams' | 'Sports' | 'Matchups' | 'Events' | 'BettingLocks' | 'Bankroll' | 'Pins';

type MatchupSideDraft = {
  teamId: string;
  playerIds: string[];
};

type MatchupDraft = {
  matchupId: string;
  sides: [MatchupSideDraft, MatchupSideDraft];
};

type MatchupDraftMap = Record<string, MatchupDraft[]>;


const formatAdminItemLabel = (eventName: string, itemLabel: string) => {
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

  if (eventName === 'Baseball' && gameNumber === 1) return 'Final Game';

  return itemLabel;
};

const getEditableOpeningMatchups = (event: Event) => {
  if (!event.matchups) return [];
  if (event.type === EventType.PAIRED) return event.matchups.filter((matchup) => matchup.round === 'Quarterfinal');
  if (event.type === EventType.TEAM_BRACKET) return event.matchups.filter((matchup) => matchup.round === 'Semifinal');
  return [];
};

const getRequiredPlayers = (eventType: EventType) => (eventType === EventType.PAIRED ? 2 : 4);

const isScoreableItem = (item: { status: string; options: { id: string; label: string }[] }) => {
  if (item.status === 'SETTLED') return false;
  if (item.status === 'LOCKED') return false;
  if (item.options.length < 2) return false;

  const optionIds = item.options.map((option) => option.id.trim().toLowerCase());
  if (new Set(optionIds).size !== optionIds.length) return false;

  return item.options.every((option) => (
    option.id.trim() !== ''
    && option.id !== 'TBD'
    && option.label.trim() !== ''
    && !option.label.toUpperCase().includes('TBD')
  ));
};

const hasDuplicateScoreOptions = (item: { status: string; options: { id: string; label: string }[] }) => {
  const optionIds = item.options.map((option) => option.id.trim().toLowerCase()).filter(Boolean);
  return item.status !== 'SETTLED' && optionIds.length >= 2 && new Set(optionIds).size !== optionIds.length;
};

const createMatchupDrafts = (state: TournamentState): MatchupDraftMap => {
  const getPlayerIdByName = (name: string, teamId: string) => {
    const team = state.teams.find((entry) => entry.id === teamId);
    if (!team) return '';
    return team.playerIds.find((playerId) => state.players.find((player) => player.id === playerId)?.name === name) || '';
  };

  return state.events.reduce<MatchupDraftMap>((acc, event) => {
    const openingMatchups = getEditableOpeningMatchups(event);
    if (openingMatchups.length === 0) return acc;

    acc[event.id] = openingMatchups.map((matchup) => {
      const sides = [0, 1].map((sideIndex) => {
        const teamId = matchup.participantTeamIds?.[sideIndex] || '';
        const team = state.teams.find((entry) => entry.id === teamId);
        const requiredPlayers = getRequiredPlayers(event.type);
        const playerIdsFromNames = (matchup.participantPlayers?.[sideIndex] || [])
          .map((name) => getPlayerIdByName(name, teamId))
          .filter(Boolean);
        const fallbackPlayers = team?.playerIds.slice(0, requiredPlayers) || [];
        const mergedPlayers = (playerIdsFromNames.length > 0 ? playerIdsFromNames : fallbackPlayers).slice(0, requiredPlayers);

        return { teamId, playerIds: mergedPlayers };
      }) as [MatchupSideDraft, MatchupSideDraft];

      return { matchupId: matchup.id, sides };
    });

    return acc;
  }, {});
};

const Admin: React.FC = () => {
  const { state, updateTeams, settleItem, addFunds, adjustBankroll, resetPlayerPin, saveSportsSettings, setEventBettingLocked, saveMatchupSettings, resetTournament } = useTournament();
  const [view, setView] = useState<AdminView>('Events');
  const [editingTeams, setEditingTeams] = useState<Team[]>(state.teams);
  const [selectedWinner, setSelectedWinner] = useState<{ itemId: string; optId: string } | null>(null);
  const [selectedWinnerPlayerIds, setSelectedWinnerPlayerIds] = useState<string[]>([]);
  const [fundAmounts, setFundAmounts] = useState<Record<string, string>>({});
  const [bankrollCorrection, setBankrollCorrection] = useState<{ playerId: string; amount: string } | null>(null);
  const [editingSports, setEditingSports] = useState(state.events.map((event) => ({ id: event.id, day: event.day, isVisible: event.isVisible, name: event.name })));
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [pinResetPlayerId, setPinResetPlayerId] = useState('');
  const [openScoreEventId, setOpenScoreEventId] = useState<string | null>(null);
  const [fundingPlayerId, setFundingPlayerId] = useState<string | null>(null);

  const isTeamsDirty = useMemo(() => (
    JSON.stringify(editingTeams.map((team) => ({ id: team.id, playerIds: team.playerIds }))) !==
    JSON.stringify(state.teams.map((team) => ({ id: team.id, playerIds: team.playerIds }))) ||
    !!selectedPlayerId ||
    !!selectedTeamId
  ), [editingTeams, state.teams, selectedPlayerId, selectedTeamId]);

  const isSportsDirty = useMemo(() => (
    JSON.stringify(editingSports.map((event) => ({ id: event.id, day: event.day, isVisible: event.isVisible }))) !==
    JSON.stringify(state.events.map((event) => ({ id: event.id, day: event.day, isVisible: event.isVisible })))
  ), [editingSports, state.events]);

  const isBankrollDirty = useMemo(() => (
    Object.values(fundAmounts).some((value) => String(value).trim() !== '') ||
    !!bankrollCorrection
  ), [fundAmounts, bankrollCorrection]);

  const upcomingScoreEvents = useMemo(
    () => state.events.filter((event) => (
      event.isVisible
      && event.status !== EventStatus.COMPLETE
      && event.bettableItemIds.some((itemId) => {
        const item = state.bettableItems.find((entry) => entry.id === itemId);
        return item ? isScoreableItem(item) || hasDuplicateScoreOptions(item) : false;
      })
    )),
    [state.events, state.bettableItems]
  );

  const pastScoreEvents = useMemo(
    () => state.events.filter((event) => (
      event.isVisible
      && event.status === EventStatus.COMPLETE
    )),
    [state.events]
  );

  const bettingControlEvents = useMemo(
    () => state.events.filter((event) => event.isVisible && event.status !== EventStatus.COMPLETE),
    [state.events]
  );

  useEffect(() => {
    setEditingSports(state.events.map((event) => ({ id: event.id, day: event.day, isVisible: event.isVisible, name: event.name })));
  }, [state.events]);

  useEffect(() => {
    if (openScoreEventId && ![...upcomingScoreEvents, ...pastScoreEvents].some((event) => event.id === openScoreEventId)) {
      setOpenScoreEventId(null);
    }
  }, [openScoreEventId, upcomingScoreEvents, pastScoreEvents]);

  const handleAssignPlayer = (teamIndex: number, playerId: string) => {
    const newTeams = editingTeams.map((team) => ({ ...team, playerIds: [...team.playerIds] }));
    if (newTeams[teamIndex].playerIds.includes(playerId)) return;

    const existingTeamIndex = newTeams.findIndex((team) => team.playerIds.includes(playerId));
    if (existingTeamIndex !== -1) {
      newTeams[existingTeamIndex].playerIds = newTeams[existingTeamIndex].playerIds.filter((id) => id !== playerId);
    }

    if (newTeams[teamIndex].playerIds.length >= MAX_TEAM_SIZE) {
      alert(`Each team can only have up to ${MAX_TEAM_SIZE} players.`);
      return;
    }

    newTeams[teamIndex].playerIds.push(playerId);
    setEditingTeams(newTeams);
    setSelectedPlayerId(null);
    setSelectedTeamId('');
  };

  const handleRemovePlayer = (teamIndex: number, playerId: string) => {
    const newTeams = editingTeams.map((team) => ({ ...team, playerIds: [...team.playerIds] }));
    newTeams[teamIndex].playerIds = newTeams[teamIndex].playerIds.filter((id) => id !== playerId);
    setEditingTeams(newTeams);
  };

  const validateRosters = () => {
    const allAssigned = editingTeams.flatMap((team) => team.playerIds);
    const uniqueAssigned = new Set(allAssigned);

    if (allAssigned.length !== uniqueAssigned.size) {
      return 'A player is assigned to multiple teams.';
    }

    if (allAssigned.length !== state.players.length) {
      return 'Each player must be assigned to exactly one team.';
    }

    const wrongSizeTeam = editingTeams.find((team) => team.playerIds.length < 4 || team.playerIds.length > MAX_TEAM_SIZE);
    if (wrongSizeTeam) {
      return `${wrongSizeTeam.name} must have between 4 and ${MAX_TEAM_SIZE} players.`;
    }

    return null;
  };

  const handleUpdateTeams = async () => {
    const validationError = validateRosters();
    if (validationError) {
      alert(validationError);
      return false;
    }

    if (window.confirm('Save all team changes?')) {
      await updateTeams(editingTeams);
      alert('Teams and event pools updated.');
      return true;
    }

    return false;
  };

  const handleSaveSports = async () => {
    const changedEvents = editingSports.filter((event) => {
      const currentEvent = state.events.find((entry) => entry.id === event.id);
      return currentEvent && (currentEvent.day !== event.day || currentEvent.isVisible !== event.isVisible);
    });

    if (changedEvents.length === 0) {
      alert('No sports changes to save.');
      return false;
    }

    const scoredOrFinishedEvents = changedEvents.filter((event) => {
      const currentEvent = state.events.find((entry) => entry.id === event.id);
      if (!currentEvent) return false;
      if (currentEvent.status === EventStatus.COMPLETE) return true;
      return state.bettableItems.some((item) => item.eventId === event.id && item.status === 'SETTLED');
    });

    const warningMessage = scoredOrFinishedEvents.length > 0
      ? `Warning: ${scoredOrFinishedEvents.map((event) => event.name).join(', ')} already has results entered. If you change the day or visibility for one of those events, it will need to be reset and rescored. Save these sports changes anyway?`
      : 'Save sports visibility and day changes?';

    if (!window.confirm(warningMessage)) return false;

    await saveSportsSettings(changedEvents.map((event) => ({ id: event.id, day: event.day, isVisible: event.isVisible })));

    alert('Sports settings updated.');
    return true;
  };

  const handleSetEventBettingLocked = async (eventId: string, bettingLocked: boolean) => {
    const event = state.events.find((entry) => entry.id === eventId);
    if (!event) return;

    const message = bettingLocked
      ? `Lock betting for ${event.name}? Players will not be able to place new bets for this event, but existing bets stay active.`
      : `Reopen betting for ${event.name}? Only do this if the event has not started.`;

    if (!window.confirm(message)) return;
    await setEventBettingLocked(eventId, bettingLocked);
  };

  const handleSettle = async () => {
    if (!selectedWinner) return false;
    const settledItem = state.bettableItems.find((item) => item.id === selectedWinner.itemId);
    const settledEvent = state.events.find((event) => event.id === settledItem?.eventId);
    const requiredWinningPlayers = settledEvent && settledEvent.type !== EventType.AGGREGATE;
    const requiresManualWinnerChoice = shouldChooseIndividualWinner(settledItem);
    const requiredWinnerCount = getRequiredIndividualWinnerCount(settledItem);
    if (settledItem && hasDuplicateScoreOptions(settledItem)) {
      alert('This matchup has the same team on both sides. Fix the matchup before entering a winner.');
      setSelectedWinner(null);
      setSelectedWinnerPlayerIds([]);
      return false;
    }
    if (requiresManualWinnerChoice && selectedWinnerPlayerIds.length !== requiredWinnerCount) {
      alert(`Select exactly ${requiredWinnerCount} players from the winning team before confirming.`);
      return false;
    }
    if (requiredWinningPlayers && selectedWinnerPlayerIds.length === 0) {
      alert('Select who gets the individual win before confirming.');
      return false;
    }
    if (window.confirm('Confirm winner? This will settle bankrolls for all bettors in this pool.')) {
      await settleItem(selectedWinner.itemId, selectedWinner.optId, selectedWinnerPlayerIds);
      if (settledItem?.eventId) {
        setOpenScoreEventId(settledItem.eventId);
      }
      setSelectedWinner(null);
      setSelectedWinnerPlayerIds([]);
      return true;
    }
    return false;
  };

  const handleAddFunds = async (playerId: string) => {
    const raw = fundAmounts[playerId] || '';
    const amount = Number(raw);
    const player = state.players.find((entry) => entry.id === playerId);

    if (!Number.isFinite(amount) || amount < 20) {
      alert('Minimum buy in is $20.');
      return;
    }

    if (!player) {
      alert('Player not found.');
      return;
    }

    try {
      setFundingPlayerId(playerId);
      await addFunds(playerId, amount);
      setFundAmounts((current) => ({ ...current, [playerId]: '' }));
      alert(`Added $${amount.toFixed(2)} to ${player.name}.`);
    } catch (error) {
      console.warn('Add funds failed.', error);
      alert('Funds were not added. Refresh and try again.');
    } finally {
      setFundingPlayerId(null);
    }
  };

  const openBankrollCorrection = (playerId: string) => {
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player) return;
    setBankrollCorrection({ playerId, amount: player.balance.toFixed(2) });
  };

  const handleSetBankroll = async () => {
    if (!bankrollCorrection) return;
    const player = state.players.find((entry) => entry.id === bankrollCorrection.playerId);
    const nextBalance = Number(bankrollCorrection.amount);
    if (!player) return;

    if (!Number.isFinite(nextBalance) || nextBalance < 0) {
      alert('Enter a valid bankroll amount of $0.00 or more.');
      return;
    }

    const delta = nextBalance - player.balance;
    if (delta === 0) {
      setBankrollCorrection(null);
      return;
    }

    if (!window.confirm(`Set ${player.name}'s bankroll to $${nextBalance.toFixed(2)}?`)) return;
    await adjustBankroll(player.id, delta);
    setBankrollCorrection(null);
  };

  const handleResetPin = async () => {
    const player = state.players.find((entry) => entry.id === pinResetPlayerId);
    if (!player) {
      alert('Choose a player first.');
      return;
    }

    if (!window.confirm(`Reset ${player.name}'s PIN? Their bankroll stays the same. On refresh, they will be logged out and can create a new 4 digit PIN.`)) return;

    await resetPlayerPin(player.id);
    setPinResetPlayerId('');
    alert(`${player.name}'s PIN has been reset.`);
  };

  const resetAll = async () => {
    const confirmed = window.confirm(
      'Reset the entire app to a fresh start? This clears all bets, bankrolls, scores, winners, PINs, roster edits, sports day/visibility changes, and betting locks for everyone.'
    );
    if (!confirmed) return;

    const typedConfirmation = window.prompt('Type RESET to confirm.');
    if (typedConfirmation !== 'RESET') return;

    try {
      await resetTournament();
      localStorage.clear();
      alert('The app has been reset to a fresh start.');
      window.location.reload();
    } catch (error) {
      console.warn('Full app reset failed.', error);
      alert('Reset failed. Refresh and try again.');
    }
  };

  const discardCurrentViewChanges = () => {
    if (view === 'Teams') {
      setEditingTeams(state.teams.map((team) => ({ ...team, playerIds: [...team.playerIds] })));
      setSelectedPlayerId(null);
      setSelectedTeamId('');
      return;
    }

    if (view === 'Sports') {
      setEditingSports(state.events.map((event) => ({ id: event.id, day: event.day, isVisible: event.isVisible, name: event.name })));
      return;
    }

    if (view === 'Events') {
      setSelectedWinner(null);
      setSelectedWinnerPlayerIds([]);
      return;
    }

    if (view === 'Bankroll') {
      setFundAmounts({});
      setBankrollCorrection(null);
      return;
    }

    if (view === 'Pins') {
      setPinResetPlayerId('');
    }
  };

  const handleViewChange = async (nextView: AdminView) => {
    if (nextView === view) return;

    const hasUnsavedChanges =
      (view === 'Teams' && isTeamsDirty) ||
      (view === 'Sports' && isSportsDirty) ||
      (view === 'Matchups' && false) ||
      (view === 'Events' && selectedWinner !== null) ||
      (view === 'Bankroll' && isBankrollDirty);

    if (!hasUnsavedChanges) {
      setView(nextView);
      return;
    }

    if (view === 'Bankroll') {
      const discardBankrollDraft = window.confirm('You have unsubmitted bankroll amounts. Press OK to discard them and switch tabs, or Cancel to stay here.');
      if (!discardBankrollDraft) return;
      discardCurrentViewChanges();
      setView(nextView);
      return;
    }

    const shouldSave = window.confirm('You have uncommitted changes on this admin page. Press OK to save them before switching tabs, or Cancel to discard them and switch.');

    if (shouldSave) {
      let saved = false;
      if (view === 'Teams') saved = await handleUpdateTeams();
      if (view === 'Sports') saved = await handleSaveSports();
      if (view === 'Events') saved = await handleSettle();
      if (!saved) return;
    } else {
      discardCurrentViewChanges();
    }

    setView(nextView);
  };

  const getPlayerName = (playerId: string) => state.players.find((player) => player.id === playerId)?.name || 'Unknown';
  const assignedTeamForSelectedPlayer = selectedPlayerId
    ? editingTeams.find((team) => team.playerIds.includes(selectedPlayerId))
    : null;
  const getOptionDisplayLabel = (label: string, optionId?: string) => {
    const rawValue = optionId || label;
    const directTeamIds = rawValue.split('+').filter(Boolean);
    const directTeams = directTeamIds
      .map((teamId) => state.teams.find((team) => team.id.toLowerCase() === teamId.toLowerCase()))
      .filter(Boolean) as Team[];

    if (directTeams.length > 0 && directTeams.length === directTeamIds.length) {
      return directTeams.map((team) => team.name).join(' + ');
    }

    const directTeam = state.teams.find((team) => team.id.toLowerCase() === label.toLowerCase());
    if (directTeam) return directTeam.name;
    return label;
  };

  const cleanScoreOptionLabel = (label: string) => (
    label
      .replace(/^[A-Za-z]+ Team [AB]:\s*/i, '')
      .replace(/\b(Blue|Green|Red|Purple) Team [AB]\b/gi, '$1 Team')
  );

  const getOptionTeams = (label: string, optionId?: string) => {
    const normalizedLabel = label.toLowerCase();
    const directTeamIds = (optionId || label).split('+').filter(Boolean);
    const directTeams = directTeamIds
      .map((teamId) => state.teams.find((team) => team.id.toLowerCase() === teamId.toLowerCase()))
      .filter(Boolean) as Team[];

    if (directTeams.length > 0) return directTeams;

    return state.teams.filter((team) => (
      normalizedLabel === team.id.toLowerCase()
      || normalizedLabel.includes(team.name.toLowerCase())
      || normalizedLabel.includes(team.color.toLowerCase())
    ));
  };

  const getPlayerIdByName = (name: string, teamId?: string) => {
    const normalizedName = name.toLowerCase();
    const team = teamId ? state.teams.find((entry) => entry.id === teamId) : undefined;
    const playerPool = team ? team.playerIds : state.players.map((player) => player.id);

    return playerPool.find((playerId) => state.players.find((player) => player.id === playerId)?.name.toLowerCase() === normalizedName) || '';
  };

  const getWinningPlayerCandidates = (item: BettableItem, optionId: string) => {
    const event = state.events.find((entry) => entry.id === item.eventId);
    if (!event || event.type === EventType.AGGREGATE) return [];

    const matchup = event.matchups?.find((entry) => entry.id === item.matchupId);
    const optionIndex = matchup?.participantIds?.findIndex((participantId) => participantId === optionId) ?? -1;
    const shouldUseFullTeamRoster = matchup?.round === 'Semifinal' || matchup?.round === 'Final';
    const teamIds = event.type === EventType.PAIRED
      ? [optionId.split('-pair-')[0]].filter(Boolean)
      : optionId.split('+').filter(Boolean);
    const candidateTeamIds = teamIds.length > 0 ? teamIds : (matchup?.participantTeamIds?.[optionIndex] ? [matchup.participantTeamIds[optionIndex]] : []);
    const participantNames = optionIndex >= 0 ? matchup?.participantPlayers?.[optionIndex] || [] : [];
    const playerIdsFromNames = participantNames
      .map((name) => getPlayerIdByName(name, candidateTeamIds[0]))
      .filter(Boolean);
    const fallbackPlayerIds = candidateTeamIds.flatMap((teamId) => state.teams.find((team) => team.id === teamId)?.playerIds || []);
    const playerIds = !shouldUseFullTeamRoster && playerIdsFromNames.length > 0 ? playerIdsFromNames : fallbackPlayerIds;

    return [...new Set(playerIds)]
      .map((playerId) => state.players.find((player) => player.id === playerId))
      .filter(Boolean) as typeof state.players;
  };

  const shouldChooseIndividualWinner = (item?: BettableItem) => {
    if (!item) return false;
    const event = state.events.find((entry) => entry.id === item.eventId);
    if (!event || event.type === EventType.AGGREGATE) return false;

    const matchup = event.matchups?.find((entry) => entry.id === item.matchupId);
    return matchup?.round === 'Semifinal' || matchup?.round === 'Final';
  };

  const getRequiredIndividualWinnerCount = (item?: BettableItem) => {
    if (!item) return 0;
    const event = state.events.find((entry) => entry.id === item.eventId);
    if (!event || event.type === EventType.AGGREGATE) return 0;
    return event.type === EventType.PAIRED ? 2 : 4;
  };

  const selectWinner = (item: BettableItem, optionId: string) => {
    setSelectedWinner({ itemId: item.id, optId: optionId });
    setSelectedWinnerPlayerIds(shouldChooseIndividualWinner(item) ? [] : getWinningPlayerCandidates(item, optionId).map((player) => player.id));
  };

  const getOptionStyle = (label: string, isSelected: boolean, optionId?: string) => {
    const teams = getOptionTeams(label, optionId);

    if (teams.length === 0) {
      return {
        className: isSelected
          ? 'border-amber-500 bg-amber-500 text-black'
          : 'border-slate-800 bg-slate-900 text-slate-300'
      };
    }

    const background = teams.length === 1
      ? `linear-gradient(135deg, ${teams[0].colorHex}CC 0%, rgba(15,23,42,0.82) 100%)`
      : `linear-gradient(135deg, ${teams[0].colorHex}CC 0%, ${teams[0].colorHex}99 42%, ${teams[1].colorHex}99 58%, ${teams[1].colorHex}CC 100%)`;

    return {
      className: isSelected
        ? 'border-white text-white shadow-[0_0_0_1px_rgba(255,255,255,0.18)]'
        : 'border-white/10 text-white',
      style: { background }
    };
  };

  const getResultCardStyle = (label: string, optionId?: string): React.CSSProperties => {
    const teams = getOptionTeams(label, optionId);
    if (teams.length === 0) {
      return {
        background: 'rgba(2,6,23,0.82)',
        borderColor: 'rgba(51,65,85,0.95)'
      };
    }

    const background = teams.length === 1
      ? `linear-gradient(135deg, ${teams[0].colorHex}4D 0%, rgba(2,6,23,0.92) 72%)`
      : `linear-gradient(135deg, ${teams[0].colorHex}4D 0%, rgba(2,6,23,0.88) 48%, ${teams[1].colorHex}4D 100%)`;

    return {
      background,
      borderColor: `${teams[0].colorHex}99`
    };
  };

  const renderEnteredResult = (event: Event, item: BettableItem, compact = false) => {
    const winnerOption = item.options.find((option) => option.id === item.winnerOptionId);
    const winnerLabel = winnerOption?.label || item.winnerOptionId || 'Unknown';
    const displayWinner = cleanScoreOptionLabel(getOptionDisplayLabel(winnerLabel, winnerOption?.id || item.winnerOptionId));

    if (compact) {
      return (
        <div
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
          style={getResultCardStyle(winnerLabel, winnerOption?.id || item.winnerOptionId)}
        >
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{formatAdminItemLabel(event.name, item.label)}</div>
          <div className="truncate text-xs font-black uppercase text-white">{displayWinner}</div>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className="flex items-center justify-between gap-3 rounded-xl border px-3 py-3"
        style={getResultCardStyle(winnerLabel, winnerOption?.id || item.winnerOptionId)}
      >
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{formatAdminItemLabel(event.name, item.label)}</div>
          <div className="mt-0.5 truncate text-sm font-black uppercase text-white">{displayWinner}</div>
        </div>
        <div className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white">
          Won
        </div>
      </div>
    );
  };

  const renderScoreEventCard = (event: Event, section: 'upcoming' | 'past') => {
    const isOpen = openScoreEventId === event.id;
    const eventWinnerTeams = (event.winnerTeamIds?.length ? event.winnerTeamIds : event.winnerTeamId ? [event.winnerTeamId] : [])
      .map((teamId) => state.teams.find((team) => team.id === teamId))
      .filter(Boolean) as Team[];
    const eventWinner = eventWinnerTeams.length > 0 ? eventWinnerTeams.map((team) => team.name).join(' + ') : undefined;
    const eventWinnerStyle: React.CSSProperties = eventWinnerTeams.length > 0
      ? {
          background: eventWinnerTeams.length === 1
            ? `linear-gradient(135deg, ${eventWinnerTeams[0].colorHex}4D 0%, rgba(2,6,23,0.92) 72%)`
            : `linear-gradient(135deg, ${eventWinnerTeams[0].colorHex}4D 0%, rgba(2,6,23,0.88) 48%, ${eventWinnerTeams[1].colorHex}4D 100%)`,
          borderColor: `${eventWinnerTeams[0].colorHex}99`,
          color: '#fff'
        }
      : {};
    const pendingItems = event.bettableItemIds
      .map((itemId) => state.bettableItems.find((entry) => entry.id === itemId))
      .filter((item) => item && isScoreableItem(item));
    const duplicateOptionItems = event.bettableItemIds
      .map((itemId) => state.bettableItems.find((entry) => entry.id === itemId))
      .filter((item) => item && hasDuplicateScoreOptions(item));
    const settledItems = event.bettableItemIds
      .map((itemId) => state.bettableItems.find((entry) => entry.id === itemId))
      .filter((item) => item && item.status === 'SETTLED');

    return (
      <div key={event.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <button
          type="button"
          onClick={() => setOpenScoreEventId((current) => current === event.id ? null : event.id)}
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
        >
          <div className="min-w-0">
            <h3 className="truncate text-xl font-black italic uppercase text-slate-100">{event.name}</h3>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              {section === 'past'
                ? `${settledItems.length} result${settledItems.length === 1 ? '' : 's'} entered`
                : `${pendingItems.length} item${pendingItems.length === 1 ? '' : 's'} ready to score`}
            </div>
          </div>
          <svg className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="space-y-3 border-t border-slate-800 p-4">
            {section === 'upcoming' ? (
              <div className="space-y-3">
                {pendingItems.map((item) => {
                  if (!item) return null;

                  return (
                    <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">{formatAdminItemLabel(event.name, item.label)}</p>
                      <div className="grid grid-cols-1 gap-2">
                        {item.options.map((opt, optionIndex) => {
                          const isSelected = selectedWinner?.optId === opt.id && selectedWinner?.itemId === item.id;
                          const buttonStyle = getOptionStyle(opt.label, isSelected, opt.id);
                          const displayLabel = cleanScoreOptionLabel(getOptionDisplayLabel(opt.label, opt.id));

                          return (
                            <button
                              key={`${opt.id}-${optionIndex}`}
                              onClick={() => selectWinner(item, opt.id)}
                              className={`rounded border px-3 py-3 text-left text-[10px] font-black uppercase ${buttonStyle.className}`}
                              style={buttonStyle.style}
                            >
                              Winner: {displayLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {duplicateOptionItems.length > 0 ? (
                  <div className="space-y-2">
                    {duplicateOptionItems.map((item) => item ? (
                      <div key={item.id} className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-[11px] font-black uppercase tracking-[0.12em] text-amber-200">
                        {formatAdminItemLabel(event.name, item.label)} needs two different teams before it can be scored.
                      </div>
                    ) : null)}
                  </div>
                ) : null}

                {settledItems.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Entered Results</div>
                    {settledItems.map((item) => item ? renderEnteredResult(event, item) : null)}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                {eventWinner ? (
                  <div className="rounded-xl border px-3 py-3" style={eventWinnerStyle}>
                    <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/65">Event Winner</div>
                    <div className="mt-0.5 text-sm font-black uppercase text-white">{eventWinner}</div>
                  </div>
                ) : null}
                {settledItems.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-[11px] italic text-slate-500">No settled scoring items found.</div>
                ) : (
                  <div className="space-y-1.5">
                    {settledItems.map((item) => item ? renderEnteredResult(event, item, true) : null)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const selectedWinnerItem = selectedWinner ? state.bettableItems.find((item) => item.id === selectedWinner.itemId) : undefined;
  const selectedWinnerEvent = selectedWinnerItem ? state.events.find((event) => event.id === selectedWinnerItem.eventId) : undefined;
  const selectedWinnerCandidates = selectedWinner && selectedWinnerItem ? getWinningPlayerCandidates(selectedWinnerItem, selectedWinner.optId) : [];
  const selectedWinnerNeedsPlayerChoice = shouldChooseIndividualWinner(selectedWinnerItem);
  const selectedWinnerRequiredCount = getRequiredIndividualWinnerCount(selectedWinnerItem);

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-black italic uppercase tracking-tight text-amber-500">Commissioner Hub</h1>
        <button onClick={() => { sessionStorage.removeItem('hawken_admin_authed'); window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-black uppercase tracking-widest text-slate-300">Exit</button>
      </div>

      <div className="mb-8 space-y-3">
        <button
          onClick={() => void handleViewChange('Events')}
          className={`w-full rounded-xl py-5 text-sm font-black uppercase tracking-[0.18em] shadow-lg transition-transform active:scale-[0.99] ${
            view === 'Events' ? 'bg-amber-500 text-black shadow-amber-500/20' : 'border border-amber-500/25 bg-amber-500/10 text-amber-300'
          }`}
        >
          Score Events
        </button>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button onClick={() => void handleViewChange('Teams')} className={`rounded py-3 text-xs font-bold uppercase tracking-widest ${view === 'Teams' ? 'bg-amber-500 text-black' : 'bg-slate-900 text-slate-500'}`}>Setup Teams</button>
          <button onClick={() => void handleViewChange('Sports')} className={`rounded py-3 text-xs font-bold uppercase tracking-widest ${view === 'Sports' ? 'bg-amber-500 text-black' : 'bg-slate-900 text-slate-500'}`}>Sports</button>
          <button onClick={() => void handleViewChange('Matchups')} className={`rounded py-3 text-xs font-bold uppercase tracking-widest ${view === 'Matchups' ? 'bg-amber-500 text-black' : 'bg-slate-900 text-slate-500'}`}>Matchups</button>
          <button onClick={() => void handleViewChange('BettingLocks')} className={`rounded py-3 text-xs font-bold uppercase tracking-widest ${view === 'BettingLocks' ? 'bg-amber-500 text-black' : 'bg-slate-900 text-slate-500'}`}>Betting Locks</button>
          <button onClick={() => void handleViewChange('Bankroll')} className={`rounded py-3 text-xs font-bold uppercase tracking-widest ${view === 'Bankroll' ? 'bg-amber-500 text-black' : 'bg-slate-900 text-slate-500'}`}>Bankroll</button>
          <button onClick={() => void handleViewChange('Pins')} className={`rounded py-3 text-xs font-bold uppercase tracking-widest ${view === 'Pins' ? 'bg-amber-500 text-black' : 'bg-slate-900 text-slate-500'}`}>Reset PIN</button>
        </div>
      </div>

      {view === 'Teams' ? (
        <div className="space-y-6">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Assign Players</div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Select a player, choose a team, then tap assign. If they were already on a team, they move automatically.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <select
                value={selectedPlayerId || ''}
                onChange={(e) => setSelectedPlayerId(e.target.value || null)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm font-black text-white"
              >
                <option value="">Select Player</option>
                {state.players.map((player) => {
                  const assignedTeam = editingTeams.find((team) => team.playerIds.includes(player.id));
                  return (
                    <option key={player.id} value={player.id}>
                      {player.name}{assignedTeam ? ` - ${assignedTeam.name}` : ''}
                    </option>
                  );
                })}
              </select>

              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm font-black text-white"
              >
                <option value="">Assign To Team</option>
                {editingTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  if (!selectedPlayerId || !selectedTeamId) return;
                  const teamIndex = editingTeams.findIndex((team) => team.id === selectedTeamId);
                  if (teamIndex !== -1) handleAssignPlayer(teamIndex, selectedPlayerId);
                }}
                disabled={!selectedPlayerId || !selectedTeamId}
                className={`rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest ${
                  !selectedPlayerId || !selectedTeamId ? 'border border-slate-800 bg-slate-950 text-slate-600' : 'bg-white text-black'
                }`}
              >
                Assign
              </button>
            </div>

            {selectedPlayerId && (
              <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                {getPlayerName(selectedPlayerId)} is currently {assignedTeamForSelectedPlayer ? `on ${assignedTeamForSelectedPlayer.name}` : 'unassigned'}
              </div>
            )}
          </div>

          {editingTeams.map((team, tIdx) => (
            <div key={team.id} className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center text-lg font-black uppercase">
                    <div className="mr-2 h-3 w-3 rounded-full" style={{ backgroundColor: team.colorHex }} />
                    {team.name}
                  </h3>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{team.playerIds.length}/{MAX_TEAM_SIZE} players</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {team.playerIds.map((playerId) => (
                  <div key={playerId} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                    <span className="text-[10px] font-black uppercase tracking-wide text-white">{getPlayerName(playerId)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePlayer(tIdx, playerId)}
                      className="rounded-md border border-slate-700 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 4 - team.playerIds.length) }).map((_, idx) => (
                  <div key={`${team.id}-empty-${idx}`} className="rounded-xl border border-dashed border-slate-800 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                    Empty Slot
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button onClick={handleUpdateTeams} className="w-full rounded-xl bg-white py-5 text-lg font-black uppercase tracking-widest text-black transition-transform hover:scale-[1.02]">Save Rosters & Update Events</button>
          <button onClick={() => void resetAll()} className="mt-12 w-full rounded-lg border border-rose-900 py-3 text-[10px] font-black uppercase tracking-widest text-rose-500">Reset Entire App To Fresh Start</button>
        </div>
      ) : view === 'Sports' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sports Played</div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Adjust event visibility and day placement here, then confirm all changes together.</p>
          </div>

          {editingSports.map((event) => {
            const committedEvent = state.events.find((entry) => entry.id === event.id);

            return (
            <div key={event.id} className={`flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors ${event.isVisible ? 'border-slate-800 bg-slate-900' : 'border-slate-800/70 bg-slate-950/70 opacity-55 grayscale-[0.2]'}`} >
              <div className="min-w-0">
                <div className="text-sm font-black uppercase text-white">{event.name}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Currently Day {committedEvent?.day || event.day}</div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={event.day}
                  onChange={(e) => setEditingSports((current) => current.map((entry) => entry.id === event.id ? { ...entry, day: Number(e.target.value) as 1 | 2 } : entry))}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white"
                >
                  <option value={1}>Day 1</option>
                  <option value={2}>Day 2</option>
                </select>
                <button
                  onClick={() => setEditingSports((current) => current.map((entry) => entry.id === event.id ? { ...entry, isVisible: !entry.isVisible } : entry))}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${event.isVisible ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-slate-700 bg-slate-950 text-slate-400'}`}
                >
                  {event.isVisible ? 'Shown' : 'Hidden'}
                </button>
              </div>
            </div>
          )})}

          <button onClick={handleSaveSports} className="w-full rounded-xl bg-white py-5 text-lg font-black uppercase tracking-widest text-black transition-transform hover:scale-[1.02]">Confirm Changes</button>
        </div>
      ) : view === 'Matchups' ? (
        <MatchupsAdmin />
      ) : view === 'Events' ? (
        <div className="space-y-8">
          <section className="space-y-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Ready To Score</div>
              <p className="mt-1 text-[11px] text-slate-500">Active events stay here until the full event is complete.</p>
            </div>

            {upcomingScoreEvents.map((event) => renderScoreEventCard(event, 'upcoming'))}

            {upcomingScoreEvents.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm italic text-slate-500">No upcoming visible events to score.</div>
            ) : null}
          </section>

          <section className="space-y-3 border-t border-slate-800 pt-6">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Past Events</div>
              <p className="mt-1 text-[11px] text-slate-500">Completed events are listed here after the event winner is set.</p>
            </div>

            {pastScoreEvents.map((event) => renderScoreEventCard(event, 'past'))}

            {pastScoreEvents.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm italic text-slate-500">No past completed events yet.</div>
            ) : null}
          </section>

          {selectedWinner && (
            <div className="animate-in slide-in-from-bottom-20 fixed bottom-0 left-0 right-0 z-[100] bg-amber-500 p-4 text-black shadow-[0_-10px_30px_rgba(245,158,11,0.3)]">
              <div className="mx-auto max-w-screen-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest opacity-80">Ready to settle</div>
                    <div className="text-xl font-black italic uppercase tracking-tighter">Winner Selected</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedWinner(null);
                        setSelectedWinnerPlayerIds([]);
                      }}
                      className="rounded-xl border border-black/20 px-4 py-4 text-sm font-black uppercase tracking-widest text-black/70 transition-transform active:scale-95"
                    >
                      Cancel
                    </button>
                    <button onClick={handleSettle} className="rounded-xl bg-black px-5 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-transform active:scale-95">Confirm</button>
                  </div>
                </div>

                {selectedWinnerEvent && selectedWinnerNeedsPlayerChoice ? (
                  <div className="rounded-2xl border border-black/15 bg-black/10 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.16em] opacity-75">Who gets the win?</div>
                      <div className="text-[9px] font-black uppercase tracking-[0.16em] opacity-75">
                        {selectedWinnerPlayerIds.length}/{selectedWinnerRequiredCount} Selected
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedWinnerCandidates.map((player) => {
                        const isSelected = selectedWinnerPlayerIds.includes(player.id);
                        return (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => setSelectedWinnerPlayerIds((current) => {
                              if (current.includes(player.id)) {
                                return current.filter((playerId) => playerId !== player.id);
                              }
                              if (current.length >= selectedWinnerRequiredCount) return current;
                              return [...current, player.id];
                            })}
                            className={`rounded-xl border px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide ${
                              isSelected ? 'border-black bg-black text-white' : 'border-black/20 bg-white/20 text-black'
                            }`}
                          >
                            {player.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : view === 'BettingLocks' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Betting Locks</div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Lock betting when an event is starting. Players cannot place new bets after this, but existing bets stay active and results can still be entered.</p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">For 2v2 tournaments, semifinals stay locked automatically. Finals open automatically once the final matchup is set.</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {bettingControlEvents.map((event) => {
              const eventItems = state.bettableItems.filter((item) => item.eventId === event.id);
              const openMarkets = eventItems.filter((item) => item.status === 'OPEN' && !item.bettingLocked).length;
              const activeBets = state.bets.filter((bet) => eventItems.some((item) => item.id === bet.bettableItemId) && !bet.refunded && !bet.voided).length;
              const readyMarkets = eventItems.filter((item) => item.status === 'OPEN');
              const isLocked = readyMarkets.length > 0 && readyMarkets.every((item) => item.bettingLocked);

              return (
                <div key={event.id} className={`rounded-2xl border p-4 ${isLocked ? 'border-amber-500/25 bg-amber-500/10' : 'border-slate-800 bg-slate-900'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black uppercase text-white">{event.name}</div>
                      <div className={`mt-1 text-[10px] font-black uppercase tracking-[0.14em] ${isLocked ? 'text-amber-300' : 'text-emerald-400'}`}>
                        {isLocked ? 'Betting Locked' : `${openMarkets} open market${openMarkets === 1 ? '' : 's'}`}
                      </div>
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{activeBets} active bet{activeBets === 1 ? '' : 's'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSetEventBettingLocked(event.id, !isLocked)}
                      className={`shrink-0 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] ${
                        isLocked
                          ? 'border border-slate-700 bg-slate-950 text-slate-300'
                          : 'bg-amber-500 text-black'
                      }`}
                    >
                      {isLocked ? 'Reopen' : 'Lock'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {bettingControlEvents.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm italic text-slate-500">No active visible events to lock.</div>
          ) : null}
        </div>
      ) : view === 'Bankroll' ? (
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Buy-In Process</div>
            <p className="text-[11px] leading-relaxed text-slate-400">Players start at $0. Use Add Funds for confirmed Venmo buy-ins. Use Correct if you need to manually set someone's bankroll after a mistake.</p>
          </div>

          {state.players.map((player) => (
            <div key={player.id} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">{player.name}</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Current bankroll</div>
                </div>
                <div className="shrink-0 text-xl font-black text-emerald-400">${player.balance.toFixed(2)}</div>
              </div>

              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">$</span>
                  <input
                    type="number"
                    min={20}
                    value={fundAmounts[player.id] || ''}
                    onChange={(e) => setFundAmounts((current) => ({ ...current, [player.id]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pl-5 pr-2 text-center text-sm font-black text-white"
                    placeholder="Buy-in"
                  />
                </div>
                <button
                  onClick={() => void handleAddFunds(player.id)}
                  disabled={fundingPlayerId === player.id}
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black disabled:cursor-wait disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {fundingPlayerId === player.id ? 'Adding' : 'Add Funds'}
                </button>
                <button
                  onClick={() => openBankrollCorrection(player.id)}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-300"
                >
                  Correct
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reset Player PIN</div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Clears a player's PIN without changing their bankroll, bets, or team. After they refresh, they will be sent back to login and can create a new 4 digit PIN.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Player</label>
            <select
              value={pinResetPlayerId}
              onChange={(e) => setPinResetPlayerId(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm font-black text-white"
            >
              <option value="">Select Player</option>
              {[...state.players].sort((a, b) => a.name.localeCompare(b.name)).map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} {player.pin ? '- PIN set' : '- needs PIN'}
                </option>
              ))}
            </select>

            <button
              onClick={() => void handleResetPin()}
              disabled={!pinResetPlayerId}
              className={`mt-4 w-full rounded-xl py-4 text-[11px] font-black uppercase tracking-widest ${
                pinResetPlayerId ? 'bg-white text-black' : 'border border-slate-800 bg-slate-950 text-slate-600'
              }`}
            >
              Reset Selected PIN
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Current Player PINs</div>
            <div className="space-y-2">
              {[...state.players].sort((a, b) => a.name.localeCompare(b.name)).map((player) => (
                <div key={player.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5">
                  <div className="min-w-0 truncate text-[11px] font-black uppercase tracking-[0.08em] text-white">{player.name}</div>
                  <div className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-black tracking-[0.18em] ${
                    player.pin ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border border-slate-700 bg-slate-900 text-slate-500'
                  }`}>
                    {player.pin || 'NONE'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {bankrollCorrection ? (() => {
        const player = state.players.find((entry) => entry.id === bankrollCorrection.playerId);
        if (!player) return null;

        return (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-[24px] border border-slate-700 bg-slate-950 p-5 shadow-2xl">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Correct Bankroll</div>
              <div className="mt-2 text-2xl font-black italic uppercase text-white">{player.name}</div>
              <div className="mt-1 text-[11px] font-bold text-slate-500">Current: ${player.balance.toFixed(2)}</div>

              <label className="mt-5 block text-[10px] font-black uppercase tracking-widest text-slate-500">Set Bankroll To</label>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">$</span>
                <input
                  type="number"
                  min={0}
                  value={bankrollCorrection.amount}
                  onChange={(e) => setBankrollCorrection((current) => current ? { ...current, amount: e.target.value } : current)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 py-4 pl-8 pr-3 text-center text-2xl font-black text-white outline-none focus:border-amber-400/60"
                  placeholder="0.00"
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setBankrollCorrection(null)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSetBankroll()}
                  className="rounded-xl bg-amber-500 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
};

export default Admin;






