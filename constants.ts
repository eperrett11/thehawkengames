import { EventType } from './types';

interface EventSeed {
  id: string;
  name: string;
  day: 1 | 2;
  type: EventType;
  items: string[];
  isVisible?: boolean;
}
export const PLAYER_DEFS = [
  { id: 'p0', name: 'Hawken' },
  { id: 'p1', name: 'Forrest' },
  { id: 'p2', name: 'Andrew' },
  { id: 'p3', name: 'Bobby' },
  { id: 'p4', name: 'Brendan' },
  { id: 'p5', name: 'Clay' },
  { id: 'p6', name: 'Cole' },
  { id: 'p7', name: 'Connor' },
  { id: 'p8', name: 'Eli' },
  { id: 'p9', name: 'Jack' },
  { id: 'p10', name: 'Jordan' },
  { id: 'p11', name: 'Justin' },
  { id: 'p12', name: 'Luke' },
  { id: 'p14', name: 'Kai' },
  { id: 'p15', name: 'Nolan' },
  { id: 'p17', name: 'Ben' }
] as const;

export const TEAMS_INIT = [
  { id: 't1', name: 'Blue Team', color: 'Blue', colorHex: '#2563eb' },
  { id: 't2', name: 'Green Team', color: 'Green', colorHex: '#16a34a' },
  { id: 't3', name: 'Red Team', color: 'Red', colorHex: '#dc2626' },
  { id: 't4', name: 'Purple Team', color: 'Purple', colorHex: '#9333ea' }
];

export const FORMAT_RULES: Record<string, { rules: string[]; style: string }> = {
  'Pickleball': {
    style: '2V2 BRACKETED TOURNAMENT',
    rules: [
      'Quarterfinal games to 7.',
      'Semifinal games to 11.',
      'Final game to 15.'
    ]
  },
  'Spikeball': {
    style: '2V2 BRACKETED TOURNAMENT',
    rules: [
      'Quarterfinal games to 7.',
      'Semifinal games to 11.',
      'Final game to 15.'
    ]
  },
  'Beer Dye': {
    style: '2V2 BRACKETED TOURNAMENT',
    rules: [
      'Quarterfinal games to 7.',
      'Semifinal games to 11.',
      'Final game to 15.'
    ]
  },
  'Cornhole': {
    style: '2V2 BRACKETED TOURNAMENT',
    rules: [
      'Quarterfinal games to 7.',
      'Semifinal games to 11.',
      'Final game to 15.'
    ]
  },
  'Basketball': {
    style: '4V4 BRACKETED TOURNAMENT',
    rules: [
      'Each team elects 4 players to play each game.',
      'Semi final game to 11.',
      'Final game to 15.'
    ]
  },
  'Soccer': {
    style: '4V4 BRACKETED TOURNAMENT',
    rules: [
      'Semi final game - 5 min, PK contest if 0-0.',
      'Final game - 10 min, PK contest if 0-0.'
    ]
  },
  'Volleyball': {
    style: '4V4 BRACKETED TOURNAMENT',
    rules: [
      'Semi final game to 11.',
      'Final game to 15.'
    ]
  },
  'Golf': {
    style: 'COMBINED TEAM AGGREGATE SCORE BASED',
    rules: [
      'Each player plays one par 3 hole.',
      'Every player records their individual score.',
      'The two lowest scores from each team are combined.',
      'The team with the overall lowest score wins.'
    ]
  },
  'Mini Putt Golf': {
    style: 'COMBINED TEAM AGGREGATE SCORE BASED',
    rules: [
      'Each player plays the course once.',
      'Every player records an individual score.',
      'Each team score is the combined total of all players on that team.',
      'The team with the lowest total score wins.'
    ]
  },
  'baseball - HR derby': {
    style: 'COMBINED TEAM AGGREGATE SCORE BASED',
    rules: [
      'Each player has 1 at bat.',
      'Every player gets 10 pitches.',
      'The number of home runs from each team member is combined for the total team score.',
      'The team with the highest total score wins.'
    ]
  },
  'Baseball': {
    style: '9V9 COMBINED TEAM EVENT',
    rules: [
      '4 teams are combined into two larger teams of 9 players each.',
      'The two combined teams then play one 9v9 baseball game.',
      'The combined team that wins the game wins the event.',
      'Both original teams on the winning side are each awarded 1 event point.'
    ]
  },
  'Swim Relay': {
    style: 'COMBINED TEAM AGGREGATE SCORE BASED',
    rules: [
      'Each team has 4 swimmers.',
      'Teams compete in a relay race, with one swimmer from each team in the water at a time.',
      'Each swimmer completes one lap before the next teammate goes.',
      'The first team to finish all four laps wins the event.'
    ]
  },
  'Pool Diving Contest': {
    style: 'COMBINED TEAM AGGREGATE SCORE BASED',
    rules: [
      'Each player completes one dive.',
      'Dive scores are added together for each team.',
      'The team with the highest total score wins.'
    ]
  },
  '100M Dash': {
    style: 'COMBINED TEAM AGGREGATE SCORE BASED',
    rules: [
      'Each player runs the 100m dash once.',
      'Every player records an individual time.',
      'Each team score is the combined total time of all players on that team.',
      'The team with the lowest combined time wins.'
    ]
  }
};

export const FORMAT_GROUP_RULES = [];

export const EVENTS_DATA: EventSeed[] = [
  { id: 'e1', name: 'Golf', day: 1, type: EventType.AGGREGATE, items: ['Overall Team Winner'] },
  { id: 'e2', name: 'Pickleball', day: 1, type: EventType.PAIRED, items: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5', 'Game 6', 'Game 7'] },
  { id: 'e3', name: 'Volleyball', day: 1, type: EventType.TEAM_BRACKET, items: ['Volleyball Winner'] },
  { id: 'e4', name: 'Spikeball', day: 1, type: EventType.PAIRED, items: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5', 'Game 6', 'Game 7'] },
  { id: 'e5', name: 'Soccer', day: 1, type: EventType.TEAM_BRACKET, items: ['Soccer Winner'] },
  { id: 'e6', name: 'Cornhole', day: 1, type: EventType.PAIRED, items: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5', 'Game 6', 'Game 7'] },
  { id: 'e17', name: '100M Dash', day: 1, type: EventType.AGGREGATE, items: ['100M Dash Winner'] },
  { id: 'e7', name: 'Mini Putt Golf', day: 2, type: EventType.AGGREGATE, items: ['Mini Putt Winner'] },
  { id: 'e8', name: 'Basketball', day: 2, type: EventType.TEAM_BRACKET, items: ['Basketball Winner'] },
  { id: 'e9', name: 'baseball - HR derby', day: 2, type: EventType.AGGREGATE, items: ['HR Derby Winner'] },
  { id: 'e10', name: 'Baseball', day: 2, type: EventType.COMBINED_TEAM, items: ['Baseball Winner'] },
  { id: 'e11', name: 'Swim Relay', day: 2, type: EventType.AGGREGATE, items: ['Swim Relay Winner'] },
  { id: 'e12', name: 'Pool Diving Contest', day: 2, type: EventType.AGGREGATE, items: ['Pool Diving Winner'] },
  { id: 'e13', name: 'Beer Dye', day: 2, type: EventType.PAIRED, items: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5', 'Game 6', 'Game 7'] },
  { id: 'e14', name: 'ALT SPORT 2v2', day: 2, type: EventType.PAIRED, items: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5', 'Game 6', 'Game 7'], isVisible: false },
  { id: 'e15', name: 'ALT SPORT 4v4', day: 2, type: EventType.TEAM_BRACKET, items: ['ALT SPORT 4v4 Winner'], isVisible: false },
  { id: 'e16', name: 'ALT SPORT AGGREGATE', day: 2, type: EventType.AGGREGATE, items: ['ALT SPORT AGGREGATE Winner'], isVisible: false }
];

