import { TOPIC_PREFIXES, TOPICS } from '../bank/topics';
import type { Difficulty, Problem, Topic } from '../bank/types';
import type { PickableProblem } from './picker';
import type { AttemptInput } from './record';
import type { Attempt } from './schema';
import type { Scheduler } from './store';

/** Shared builders for memory tests. Not used by the app. */

export const T0 = new Date(2026, 9, 8, 12, 0, 0).getTime();

export function makeProblem(overrides: Partial<Problem> = {}): Problem {
  return {
    id: 'graph-001',
    source: 'bank',
    topic: 'graphs',
    difficulty: 4,
    title: 'Labelled trees',
    statement: 'How many labelled trees are there on $4$ vertices?',
    hints: ['Think of a code for trees.', 'Use Prüfer sequences.', 'Count sequences of length 2.'],
    solution: 'By Cayley, $4^{4-2} = 16$.',
    answer: { type: 'numeric', canonical: 16, display: '16' },
    estMinutes: 10,
    ...overrides,
  };
}

export function makeAiProblem(n: number, overrides: Partial<Problem> = {}): Problem {
  return makeProblem({ id: `ai-graph-${n.toString(36)}`, source: 'ai', ...overrides });
}

export function makeAttemptInput(overrides: Partial<AttemptInput> = {}): AttemptInput {
  return {
    problemId: 'graph-001',
    source: 'bank',
    topic: 'graphs',
    difficulty: 4,
    startedAt: T0 - 5 * 60_000,
    endedAt: T0,
    activeMs: 5 * 60_000,
    hintsUsed: 0,
    agentHints: 0,
    wrongChecks: 0,
    solutionViewed: false,
    outcome: 'correct',
    checkedBy: 'local',
    ...overrides,
  };
}

export function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'a1',
    problemId: 'graph-001',
    source: 'bank',
    topic: 'graphs',
    difficulty: 4,
    startedAt: T0 - 5 * 60_000,
    endedAt: T0,
    activeMs: 5 * 60_000,
    hintsUsed: 0,
    agentHints: 0,
    wrongChecks: 0,
    solutionViewed: false,
    outcome: 'correct',
    checkedBy: 'local',
    quality: 5,
    ...overrides,
  };
}

/** 10 topics x 3 problems with difficulties 3, 4 and 5. */
export function syntheticPool(topics: readonly Topic[] = TOPICS): PickableProblem[] {
  const difficulties: readonly Difficulty[] = [3, 4, 5];
  return topics.flatMap((topic) =>
    difficulties.map((difficulty) => ({
      id: `${TOPIC_PREFIXES[topic]}-00${difficulty}`,
      topic,
      difficulty,
      source: 'bank' as const,
    })),
  );
}

export interface FakeScheduler extends Scheduler {
  /** Delays of the timers that are still waiting. */
  pending(): number[];
  /** Fires every waiting timer. */
  runAll(): void;
}

export function createFakeScheduler(): FakeScheduler {
  let next = 1;
  const timers = new Map<number, { fn: () => void; ms: number }>();
  return {
    setTimeout(fn, ms) {
      const id = next++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeout(handle) {
      if (typeof handle === 'number') timers.delete(handle);
    },
    pending: () => [...timers.values()].map((t) => t.ms),
    runAll() {
      const due = [...timers.values()];
      timers.clear();
      for (const t of due) t.fn();
    },
  };
}

/** Lets pending promise callbacks run. */
export const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
