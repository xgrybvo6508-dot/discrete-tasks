import type { Problem } from '../bank/types';
import { isSafeKey } from '../lib/guards';
import { applyAttemptToTopic } from './mastery';
import { qualityFor, type QualityInput } from './quality';
import { MAX_ANSWER_TEXT, type Attempt, type CardState, type Memory } from './schema';
import { reviewCard } from './srs';

export const MAX_UNATTEMPTED_AI = 20;

export function getCard(
  cards: Readonly<Record<string, CardState>>,
  problemId: string,
): CardState | undefined {
  return Object.hasOwn(cards, problemId) ? cards[problemId] : undefined;
}

export type AttemptInput = Omit<Attempt, 'id' | 'quality'> & Pick<QualityInput, 'estMinutes'>;

/** Builds a finished attempt and computes its quality. */
export function createAttempt(id: string, input: AttemptInput): Attempt {
  const { estMinutes, answerText, ...rest } = input;
  const attempt: Attempt = { ...rest, id, quality: qualityFor({ ...rest, estMinutes }) };
  if (answerText !== undefined) attempt.answerText = answerText.slice(0, MAX_ANSWER_TEXT);
  return attempt;
}

export interface RecordOptions {
  /** True when this attempt is a same-session retry after a miss. */
  readonly relearn?: boolean;
  readonly seed?: number;
}

/** Adds an attempt and updates the problem's card and the topic stats. Pure. */
export function recordAttempt(
  memory: Memory,
  attempt: Attempt,
  options: RecordOptions = {},
): Memory {
  if (memory.attempts.some((a) => a.id === attempt.id)) return memory;
  const card = reviewCard(getCard(memory.cards, attempt.problemId), {
    problemId: attempt.problemId,
    outcome: attempt.outcome,
    quality: attempt.quality,
    now: attempt.endedAt,
    ...(options.relearn !== undefined && { relearn: options.relearn }),
    ...(options.seed !== undefined && { seed: options.seed }),
  });
  const cards =
    card && isSafeKey(attempt.problemId)
      ? { ...memory.cards, [attempt.problemId]: card }
      : memory.cards;
  return {
    ...memory,
    updatedAt: Math.max(memory.updatedAt, attempt.endedAt),
    attempts: [...memory.attempts, attempt],
    cards,
    topics: {
      ...memory.topics,
      [attempt.topic]: applyAttemptToTopic(memory.topics[attempt.topic], attempt),
    },
  };
}

/**
 * Caches a generated problem. Problems with attempts are never pruned; only the oldest
 * unattempted ones beyond MAX_UNATTEMPTED_AI are dropped.
 */
export function addAiProblem(memory: Memory, problem: Problem, max = MAX_UNATTEMPTED_AI): Memory {
  if (problem.source !== 'ai' || memory.aiProblems.some((p) => p.id === problem.id)) return memory;
  const attempted = new Set(memory.attempts.map((a) => a.problemId));
  const all = [...memory.aiProblems, problem];
  let spare = all.filter((p) => !attempted.has(p.id)).length - max;
  const aiProblems = all.filter((p) => {
    if (spare > 0 && !attempted.has(p.id) && p.id !== problem.id) {
      spare--;
      return false;
    }
    return true;
  });
  return { ...memory, aiProblems };
}
