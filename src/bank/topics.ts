import type { Topic } from './types';

export const TOPICS: readonly Topic[] = [
  'combinatorics',
  'graphs',
  'logic',
  'sets',
  'relations',
  'induction',
  'recurrences',
  'boolean',
  'number-theory',
  'counting-principles',
];

export const TOPIC_LABELS: Readonly<Record<Topic, string>> = {
  combinatorics: 'Combinatorics',
  graphs: 'Graphs',
  logic: 'Logic',
  sets: 'Sets',
  relations: 'Relations and orders',
  induction: 'Induction',
  recurrences: 'Recurrences',
  boolean: 'Boolean functions',
  'number-theory': 'Number theory',
  'counting-principles': 'Counting principles',
};

export const TOPIC_PREFIXES: Readonly<Record<Topic, string>> = {
  combinatorics: 'comb',
  graphs: 'graph',
  logic: 'logic',
  sets: 'sets',
  relations: 'rel',
  induction: 'ind',
  recurrences: 'rec',
  boolean: 'bool',
  'number-theory': 'nt',
  'counting-principles': 'count',
};

export interface TopicPosition {
  readonly x: number;
  readonly y: number;
}

/** Stable positions in a 1000 by 620 topic-map view box. */
export const TOPIC_POSITIONS: Readonly<Record<Topic, TopicPosition>> = {
  combinatorics: { x: 180, y: 130 },
  'counting-principles': { x: 500, y: 70 },
  'number-theory': { x: 820, y: 130 },
  recurrences: { x: 160, y: 340 },
  induction: { x: 500, y: 290 },
  graphs: { x: 800, y: 340 },
  logic: { x: 170, y: 540 },
  sets: { x: 390, y: 500 },
  boolean: { x: 620, y: 540 },
  relations: { x: 830, y: 520 },
};

/** Fixed edges of the topic mind map. */
export const TOPIC_EDGES: readonly (readonly [Topic, Topic])[] = [
  ['combinatorics', 'counting-principles'],
  ['combinatorics', 'recurrences'],
  ['recurrences', 'induction'],
  ['induction', 'graphs'],
  ['graphs', 'relations'],
  ['relations', 'sets'],
  ['sets', 'logic'],
  ['logic', 'boolean'],
  ['boolean', 'relations'],
  ['number-theory', 'counting-principles'],
  ['number-theory', 'induction'],
];

const TOPIC_SET: ReadonlySet<string> = new Set(TOPICS);

export function isTopic(value: unknown): value is Topic {
  return typeof value === 'string' && TOPIC_SET.has(value);
}
