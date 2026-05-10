import React, { useEffect, useMemo, useState } from 'react';
import { useTournament } from '../store';
import { Event, EventStatus, EventType, TournamentState } from '../types';

type MatchupSideDraft = {
  teamId: string;
  playerIds: string[];
};

type MatchupDraft = {
  matchupId: string;
  sides: [MatchupSideDraft, MatchupSideDraft];
};

type MatchupDraftMap = Record<string, MatchupDraft[]>;

const getEditableOpeningMatchups = (event: Event) => {
  if (!event.matchups) return [];
  if (event.type === EventType.PAIRED) return event.matchups.filter((matchup) => matchup.round === 'Quarterfinal');
  if (event.type === EventType.TEAM_BRACKET) return event.matchups.filter((matchup) => matchup.round === 'Semifinal');
  return [];
};

const getRequiredPlayers = (eventType: EventType) => (eventType === EventType.PAIRED ? 2 : 4);

const formatMatchupLabel = (eventName: string, gameNumber: number) => {
  if (['Pickleball', 'Spikeball', 'Beer Dye', 'Cornhole', 'ALT SPORT 2v2'].includes(eventName) && gameNumber <= 4) {
    return `Quarterfinal Game ${gameNumber}`;
  }
  if (['Volleyball', 'Soccer', 'Basketball', 'ALT SPORT 4v4'].includes(eventName)) {
    return `Semi Final Game ${gameNumber}`;
  }
  return `Game ${gameNumber}`;
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
        return {
          teamId,
          playerIds: (playerIdsFromNames.length > 0 ? playerIdsFromNames : fallbackPlayers).slice(0, requiredPlayers)
        };
      }) as [MatchupSideDraft, MatchupSideDraft];

      return { matchupId: matchup.id, sides };
    });

    return acc;
  }, {});
};

const MatchupsAdmin: React.FC = () => {
  const { state, saveMatchupSettings, voidEventBets } = useTournament();
  const [editingMatchups, setEditingMatchups] = useState<MatchupDraftMap>(() => createMatchupDrafts(state));
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [hasInitializedOpenEvent, setHasInitializedOpenEvent] = useState(false);

  const matchupBaseline = useMemo(() => createMatchupDrafts(state), [state]);
  const editableEvents = useMemo(() => state.events.filter((event) => getEditableOpeningMatchups(event).length > 0), [state.events]);

  useEffect(() => {
    setEditingMatchups(createMatchupDrafts(state));
  }, [state.events, state.teams, state.players]);

  useEffect(() => {
    if (!hasInitializedOpenEvent && editableEvents.length > 0) {
      setOpenEventId(editableEvents[0].id);
      setHasInitializedOpenEvent(true);
      return;
    }
    if (openEventId && !editableEvents.some((event) => event.id === openEventId)) {
      setOpenEventId(editableEvents[0]?.id || null);
    }
    if (!editableEvents.length) {
      setOpenEventId(null);
    }
  }, [editableEvents, hasInitializedOpenEvent, openEventId]);

  const getPlayerName = (playerId: string) => state.players.find((player) => player.id === playerId)?.name || 'Unknown';

  const getUnvoidedEventBets = (eventId: string) => {
    const eventItemIds = new Set(state.bettableItems.filter((item) => item.eventId === eventId).map((item) => item.id));
    return state.bets.filter((bet) => eventItemIds.has(bet.bettableItemId) && !bet.refunded && !bet.voided);
  };

  const handleVoidEventBets = async (eventId: string, eventName: string) => {
    const eventBets = getUnvoidedEventBets(eventId);
    if (eventBets.length === 0) return;

    const totalRefund = eventBets.reduce((sum, bet) => sum + (bet.payout === undefined ? bet.amount : 0), 0);
    const confirmed = window.confirm(`Void all bets for ${eventName}? This refunds $${totalRefund.toFixed(2)} in active wagers and marks those bets as VOID. You can edit the matchups after this.`);
    if (!confirmed) return;

    await voidEventBets(eventId);
    alert(`${eventName} bets voided. Matchups can now be edited.`);
  };

  const updateMatchupTeam = (eventId: string, matchupId: string, sideIndex: 0 | 1, teamId: string) => {
    setEditingMatchups((current) => {
      const next = { ...current };
      next[eventId] = (next[eventId] || []).map((matchup) => {
        if (matchup.matchupId !== matchupId) return matchup;
        const event = state.events.find((entry) => entry.id === eventId);
        const requiredPlayers = event ? getRequiredPlayers(event.type) : 2;
        const team = state.teams.find((entry) => entry.id === teamId);
        const sides = [...matchup.sides] as [MatchupSideDraft, MatchupSideDraft];
        const otherSideIndex = sideIndex === 0 ? 1 : 0;
        if (teamId && sides[otherSideIndex].teamId === teamId) {
          return matchup;
        }
        sides[sideIndex] = { teamId, playerIds: team?.playerIds.slice(0, requiredPlayers) || [] };
        return { ...matchup, sides };
      });
      return next;
    });
  };

  const updateMatchupPlayer = (eventId: string, matchupId: string, sideIndex: 0 | 1, playerIndex: number, playerId: string) => {
    setEditingMatchups((current) => {
      const next = { ...current };
      next[eventId] = (next[eventId] || []).map((matchup) => {
        if (matchup.matchupId !== matchupId) return matchup;
        const sides = [...matchup.sides] as [MatchupSideDraft, MatchupSideDraft];
        const playerIds = [...sides[sideIndex].playerIds];
        playerIds[playerIndex] = playerId;
        sides[sideIndex] = { ...sides[sideIndex], playerIds };
        return { ...matchup, sides };
      });
      return next;
    });
  };

  const handleSaveMatchups = async () => {
    const changedEventIds = Object.keys(editingMatchups).filter((eventId) => JSON.stringify(editingMatchups[eventId] || []) !== JSON.stringify(matchupBaseline[eventId] || []));
    if (changedEventIds.length === 0) {
      alert('No matchup changes to save.');
      return;
    }

    for (const eventId of changedEventIds) {
      const event = state.events.find((entry) => entry.id === eventId);
      if (!event) continue;

      const hasSettledItems = state.bettableItems.some((item) => item.eventId === eventId && item.status === 'SETTLED');
      if (hasSettledItems || event.status === EventStatus.COMPLETE) {
        alert(`${event.name} already has results entered. Matchups can only be edited before scoring begins.`);
        return;
      }

      if (getUnvoidedEventBets(eventId).length > 0) {
        alert(`${event.name} has bets placed. Void all bets for this event before editing matchups.`);
        return;
      }

      const requiredPlayers = getRequiredPlayers(event.type);
      for (const matchup of editingMatchups[eventId] || []) {
        const [leftSide, rightSide] = matchup.sides;
        if (leftSide.teamId && rightSide.teamId && leftSide.teamId === rightSide.teamId) {
          alert(`${event.name} cannot have the same team on both sides of a matchup.`);
          return;
        }

        for (const side of matchup.sides) {
          const playerIds = side.playerIds.filter(Boolean);
          if (!side.teamId) {
            alert(`Choose both teams for ${event.name}.`);
            return;
          }
          if (playerIds.length !== requiredPlayers) {
            alert(`${event.name} requires ${requiredPlayers} players selected for each side.`);
            return;
          }
          if (new Set(playerIds).size !== playerIds.length) {
            alert(`Each side in ${event.name} must use distinct players.`);
            return;
          }
        }
      }
    }

    if (!window.confirm('Save matchup changes and reset later rounds for those events?')) return;

    await saveMatchupSettings(changedEventIds.map((eventId) => ({ eventId, matchups: editingMatchups[eventId] })));
    alert('Matchups updated.');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Opening Matchups</div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Set the opening-round teams and players here the night before. Saving resets downstream rounds and refunds any open bets on those events.</p>
      </div>

      {editableEvents.map((event) => {
        const drafts = editingMatchups[event.id] || [];
        const requiredPlayers = getRequiredPlayers(event.type);
        const isOpen = openEventId === event.id;
        const unvoidedBets = getUnvoidedEventBets(event.id);
        const isLockedByBets = unvoidedBets.length > 0;

        return (
          <div key={event.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-xl font-black italic uppercase text-slate-200">{event.name}</h3>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {isLockedByBets ? `${unvoidedBets.length} bet${unvoidedBets.length === 1 ? '' : 's'} placed. Void bets before editing.` : 'Edit opening round only. Later rounds reset and repopulate from winners.'}
                </div>
              </div>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`matchups-panel-${event.id}`}
                onClick={() => setOpenEventId((current) => current === event.id ? null : event.id)}
                className={`shrink-0 rounded-full p-2 transition-colors ${isOpen ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400'}`}
              >
                <svg className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {isOpen && (
              <div id={`matchups-panel-${event.id}`} className="mt-4 space-y-3">
                {isLockedByBets ? (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">Bets Must Be Voided First</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                      This event has bets attached to it. Void all bets for this event before changing teams or players.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleVoidEventBets(event.id, event.name)}
                      className="mt-3 w-full rounded-xl border border-amber-300/40 bg-amber-300 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black"
                    >
                      Void All Bets For This Event
                    </button>
                  </div>
                ) : null}
                {drafts.map((matchupDraft, matchupIndex) => {
                  const matchup = event.matchups?.find((entry) => entry.id === matchupDraft.matchupId);
                  if (!matchup) return null;

                  return (
                    <div key={matchupDraft.matchupId} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">{formatMatchupLabel(event.name, matchup.gameNumber || matchupIndex + 1)}</div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {([0, 1] as const).map((sideIndex) => {
                          const side = matchupDraft.sides[sideIndex];
                          const team = state.teams.find((entry) => entry.id === side.teamId);
                          const teamPlayerIds = team?.playerIds || [];

                          return (
                            <div key={`${matchupDraft.matchupId}-${sideIndex}`} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Side {sideIndex + 1}</div>
                              <select disabled={isLockedByBets} value={side.teamId} onChange={(e) => updateMatchupTeam(event.id, matchupDraft.matchupId, sideIndex, e.target.value)} className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-[11px] font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-45">
                                <option value="">Select Team</option>
                                {state.teams.map((teamOption) => {
                                  const otherSideIndex = sideIndex === 0 ? 1 : 0;
                                  const isUsedOnOtherSide = matchupDraft.sides[otherSideIndex].teamId === teamOption.id;
                                  return (
                                    <option key={teamOption.id} value={teamOption.id} disabled={isUsedOnOtherSide}>
                                      {teamOption.name}
                                    </option>
                                  );
                                })}
                              </select>
                              <div className="space-y-2">
                                {Array.from({ length: requiredPlayers }).map((_, playerIndex) => (
                                  <select disabled={isLockedByBets} key={`${matchupDraft.matchupId}-${sideIndex}-${playerIndex}`} value={side.playerIds[playerIndex] || ''} onChange={(e) => updateMatchupPlayer(event.id, matchupDraft.matchupId, sideIndex, playerIndex, e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-[11px] font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-45">
                                    <option value="">Select Player {playerIndex + 1}</option>
                                    {teamPlayerIds.map((playerId) => <option key={playerId} value={playerId}>{getPlayerName(playerId)}</option>)}
                                  </select>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <button onClick={() => void handleSaveMatchups()} className="w-full rounded-xl bg-white py-5 text-lg font-black uppercase tracking-widest text-black transition-transform hover:scale-[1.02]">Confirm Matchup Changes</button>
    </div>
  );
};

export default MatchupsAdmin;
