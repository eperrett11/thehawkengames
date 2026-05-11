export enum EventStatus {
  UPCOMING = 'UPCOMING',
  COMPLETE = 'COMPLETE'
}

export enum EventType {
  PAIRED = 'PAIRED',
  TEAM_BRACKET = 'TEAM_BRACKET',
  COMBINED_TEAM = 'COMBINED_TEAM',
  AGGREGATE = 'AGGREGATE'
}

export interface Team {
  id: string;
  name: string;
  color: string;
  colorHex: string;
  playerIds: string[];
}

export interface Player {
  id: string;
  name: string;
  pin: string;
  balance: number;
  teamId?: string;
}

export interface Matchup {
  id: string;
  participants: string[];
  participantIds?: string[];
  participantTeamIds?: string[];
  participantPlayers?: string[][];
  winnerId?: string;
  winnerTeamId?: string;
  winningPlayerIds?: string[];
  score?: string;
  round?: string;
  gameNumber?: number;
  nextMatchupId?: string;
  nextMatchupSlot?: 0 | 1;
}

export interface BettableItem {
  id: string;
  eventId: string;
  label: string;
  options: { id: string; label: string }[];
  status: 'OPEN' | 'LOCKED' | 'SETTLED';
  bettingLocked?: boolean;
  winnerOptionId?: string;
  day: 1 | 2;
  matchupId?: string;
}

export interface Event {
  id: string;
  name: string;
  day: 1 | 2;
  type: EventType;
  status: EventStatus;
  isVisible: boolean;
  bettingLocked?: boolean;
  winnerTeamId?: string;
  winnerTeamIds?: string[];
  bettableItemIds: string[];
  description?: string;
  matchups?: Matchup[];
}

export interface Bet {
  id: string;
  playerId: string;
  bettableItemId: string;
  optionId: string;
  amount: number;
  timestamp: number;
  payout?: number;
  refunded?: boolean;
  voided?: boolean;
}

export interface TournamentState {
  players: Player[];
  teams: Team[];
  events: Event[];
  bettableItems: BettableItem[];
  bets: Bet[];
}
