import { TOPICS } from '../bank/topics';
import type { Difficulty, Problem, Topic } from '../bank/types';

export const MEMORY_VERSION = 1;

export type Outcome = 'correct' | 'partial' | 'incorrect' | 'skipped';
export type SelfAssessment = 'got' | 'partly' | 'missed';
export type CheckedBy = 'local' | 'agent' | 'self';
export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export const OUTCOMES: readonly Outcome[] = ['correct', 'partial', 'incorrect', 'skipped'];
export const SELF_ASSESSMENTS: readonly SelfAssessment[] = ['got', 'partly', 'missed'];
export const CHECKED_BY: readonly CheckedBy[] = ['local', 'agent', 'self'];
export const QUALITIES: readonly Quality[] = [0, 1, 2, 3, 4, 5];
export const MAX_ANSWER_TEXT = 2000;

export interface Attempt {
  id: string;
  problemId: string;
  source: 'bank' | 'ai';
  topic: Topic;
  difficulty: Difficulty;
  /** Epoch ms. */
  startedAt: number;
  endedAt: number;
  /** Visible and non-idle time only. */
  activeMs: number;
  /** Local hints revealed. */
  hintsUsed: number;
  agentHints: number;
  /** Failed checks before the final outcome. */
  wrongChecks: number;
  /** True only if the solution was opened before the outcome was decided. */
  solutionViewed: boolean;
  outcome: Outcome;
  /** Proofs only. */
  selfAssessment?: SelfAssessment;
  checkedBy: CheckedBy;
  /** Input to SM-2. */
  quality: Quality;
  /** Capped at MAX_ANSWER_TEXT characters. */
  answerText?: string;
}

export interface CardState {
  problemId: string;
  /** 1.3..2.8, starts at 2.5. */
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: number;
  lastSeenAt: number;
  lastOutcome: Outcome;
}

export interface TopicStats {
  topic: Topic;
  /** Attempts that were not skipped. */
  attempts: number;
  correct: number;
  /** 0..1, EMA-based. */
  mastery: number;
  /** Includes skips. */
  lastSeenAt: number | null;
  avgActiveMs: number;
  hintsPerAttempt: number;
}

export interface Memory {
  version: typeof MEMORY_VERSION;
  createdAt: number;
  updatedAt: number;
  /** Never pruned. */
  attempts: Attempt[];
  cards: Record<string, CardState>;
  /** Derived and cached; can always be rebuilt from attempts. */
  topics: Record<Topic, TopicStats>;
  /** Generated problems. Ones with attempts are never pruned. */
  aiProblems: Problem[];
  lastExportAt: number | null;
}

export function emptyTopicStats(topic: Topic): TopicStats {
  return {
    topic,
    attempts: 0,
    correct: 0,
    mastery: 0,
    lastSeenAt: null,
    avgActiveMs: 0,
    hintsPerAttempt: 0,
  };
}

export function emptyTopics(): Record<Topic, TopicStats> {
  return Object.fromEntries(TOPICS.map((t) => [t, emptyTopicStats(t)])) as Record<
    Topic,
    TopicStats
  >;
}

export function emptyMemory(now: number): Memory {
  return {
    version: MEMORY_VERSION,
    createdAt: now,
    updatedAt: now,
    attempts: [],
    cards: {},
    topics: emptyTopics(),
    aiProblems: [],
    lastExportAt: null,
  };
}
