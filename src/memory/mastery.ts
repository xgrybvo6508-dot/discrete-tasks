import type { Difficulty, Topic } from '../bank/types';
import { DAY_MS } from '../lib/time';
import { emptyTopics, type Attempt, type Quality, type TopicStats } from './schema';

export const DIFF_WEIGHT: Readonly<Record<Difficulty, number>> = { 3: 0.85, 4: 0.95, 5: 1 };
export const EMA_KEEP = 0.7;
export const HALF_LIFE_DAYS = 30;

export type Band = 'new' | 'learning' | 'steady' | 'strong';

export const BAND_LABELS: Readonly<Record<Band, string>> = {
  new: 'New',
  learning: 'Learning',
  steady: 'Steady',
  strong: 'Strong',
};

export const confidence = (attempts: number): number => 1 - 0.75 ** attempts;

export const attemptScore = (quality: Quality, difficulty: Difficulty): number =>
  (quality / 5) * DIFF_WEIGHT[difficulty];

/** The EMA behind a stored mastery value (mastery = ema * confidence). */
function emaOf(stats: TopicStats): number {
  return stats.attempts > 0 ? stats.mastery / confidence(stats.attempts) : 0;
}

const later = (a: number | null, b: number): number => (a === null ? b : Math.max(a, b));

/** Folds one attempt into the topic stats. A skip only updates `lastSeenAt`. */
export function applyAttemptToTopic(stats: TopicStats, attempt: Attempt): TopicStats {
  const lastSeenAt = later(stats.lastSeenAt, attempt.endedAt);
  if (attempt.outcome === 'skipped') return { ...stats, lastSeenAt };
  const n = stats.attempts + 1;
  const ema =
    EMA_KEEP * emaOf(stats) + (1 - EMA_KEEP) * attemptScore(attempt.quality, attempt.difficulty);
  return {
    topic: stats.topic,
    attempts: n,
    correct: stats.correct + (attempt.outcome === 'correct' ? 1 : 0),
    mastery: ema * confidence(n),
    lastSeenAt,
    avgActiveMs: (stats.avgActiveMs * stats.attempts + attempt.activeMs) / n,
    hintsPerAttempt:
      (stats.hintsPerAttempt * stats.attempts + attempt.hintsUsed + attempt.agentHints) / n,
  };
}

/** Rebuilds every topic's stats from the attempt log, in time order. */
export function rebuildTopics(attempts: readonly Attempt[]): Record<Topic, TopicStats> {
  const topics = emptyTopics();
  const ordered = [...attempts].sort((a, b) => a.endedAt - b.endedAt);
  for (const a of ordered) topics[a.topic] = applyAttemptToTopic(topics[a.topic], a);
  return topics;
}

/** Fractional days since the topic was last seen, or null if never. */
export function daysSinceSeen(stats: TopicStats, now: number): number | null {
  return stats.lastSeenAt === null ? null : Math.max(0, (now - stats.lastSeenAt) / DAY_MS);
}

/** Mastery that halves every 30 days without practice. Used by the picker only. */
export function decayedMastery(stats: TopicStats, now: number): number {
  const days = daysSinceSeen(stats, now);
  return days === null ? 0 : stats.mastery * 0.5 ** (days / HALF_LIFE_DAYS);
}

export function bandOf(mastery: number): Band {
  if (mastery < 0.25) return 'new';
  if (mastery < 0.5) return 'learning';
  if (mastery < 0.75) return 'steady';
  return 'strong';
}
