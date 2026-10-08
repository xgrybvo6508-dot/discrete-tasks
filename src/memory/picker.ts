import type { Difficulty, Problem, Topic } from '../bank/types';
import { weightedChoice, type Rng } from '../lib/random';
import { DAY_MS } from '../lib/time';
import { bandOf, decayedMastery, daysSinceSeen, type Band } from './mastery';
import { getCard } from './record';
import type { CardState, Outcome, TopicStats } from './schema';
import { eligibleRelearn, seenIds, topicAgo, type SessionState } from './session';
import { daysOverdue, isDue } from './srs';

export type PickableProblem = Pick<Problem, 'id' | 'topic' | 'difficulty' | 'source'>;

export const REVIEW_PROBABILITY = 0.6;
const TARGET_DIFFICULTY: Readonly<Record<Band, Difficulty>> = {
  new: 3,
  learning: 3,
  steady: 4,
  strong: 5,
};
const MIN_SCORE = 0.1;

export type PickReason =
  | { readonly kind: 'review'; readonly lastOutcome: Outcome; readonly lastSeenAt: number }
  | { readonly kind: 'relearn' }
  | { readonly kind: 'new'; readonly topic: Topic; readonly topicLastSeenAt: number | null }
  | { readonly kind: 'extra' };

export interface PickResult {
  readonly problemId: string;
  readonly reason: PickReason;
}

export interface PickInput {
  /** Every problem that may be shown: the bank plus cached AI problems. */
  readonly problems: readonly PickableProblem[];
  readonly cards: Readonly<Record<string, CardState>>;
  readonly topics: Readonly<Record<Topic, TopicStats>>;
  readonly session: SessionState;
  readonly now: number;
  readonly rng: Rng;
}

interface Candidate {
  readonly problem: PickableProblem;
  readonly slot: 'review' | 'new';
  readonly card?: CardState;
  readonly reason: PickReason;
}

function candidates(input: PickInput): Candidate[] {
  const { problems, cards, topics, session, now } = input;
  const seen = seenIds(session);
  const relearn = new Set(eligibleRelearn(session).map((r) => r.problemId));
  const out: Candidate[] = [];
  for (const problem of problems) {
    const card = getCard(cards, problem.id);
    if (relearn.has(problem.id)) {
      out.push({ problem, slot: 'review', reason: { kind: 'relearn' }, ...(card && { card }) });
    } else if (seen.has(problem.id)) {
      continue;
    } else if (card) {
      if (!isDue(card, now)) continue;
      const reason = {
        kind: 'review',
        lastOutcome: card.lastOutcome,
        lastSeenAt: card.lastSeenAt,
      } as const;
      out.push({ problem, slot: 'review', card, reason });
    } else {
      const topicLastSeenAt = topics[problem.topic].lastSeenAt;
      out.push({
        problem,
        slot: 'new',
        reason: { kind: 'new', topic: problem.topic, topicLastSeenAt },
      });
    }
  }
  return session.focusTopic ? out.filter((c) => c.problem.topic === session.focusTopic) : out;
}

function score(c: Candidate, input: PickInput, topicCount: number): number {
  const { topics, session, now } = input;
  const stats = topics[c.problem.topic];
  const weakness = 1 - decayedMastery(stats, now);
  const days = daysSinceSeen(stats, now);
  const sessionSeen = session.presented.some((p) => p.topic === c.problem.topic);
  const staleness = days === null ? 1 : Math.min(1, days / 7);
  const neverSeen = days === null && !sessionSeen;
  let overdue = 0;
  if (c.reason.kind === 'review' && c.card) {
    overdue = Math.min(1, daysOverdue(c.card, now) / Math.max(1, c.card.intervalDays));
  }
  let s = 1 + 2 * weakness + 1.5 * staleness + 1.5 * overdue + (neverSeen ? 1 : 0);
  if (c.slot === 'new') {
    const target = TARGET_DIFFICULTY[bandOf(stats.mastery)];
    s = Math.max(MIN_SCORE, s - Math.abs(c.problem.difficulty - target));
  }
  if (topicCount >= 3 && topicAgo(session, 2) === c.problem.topic) s *= 0.5;
  return s;
}

function lastSeen(
  problem: PickableProblem,
  cards: PickInput['cards'],
  session: SessionState,
): number {
  const index = session.presented.findLastIndex((p) => p.problemId === problem.id);
  if (index >= 0) return Number.MAX_SAFE_INTEGER - (session.presented.length - index) * DAY_MS;
  return getCard(cards, problem.id)?.lastSeenAt ?? 0;
}

/** When nothing is left: the least recently seen problem, avoiding a topic repeat if possible. */
function extraPractice(input: PickInput): PickResult | null {
  const { session, problems, cards } = input;
  const pool = session.focusTopic
    ? problems.filter((p) => p.topic === session.focusTopic)
    : problems;
  const current = session.presented.at(-1);
  const others = pool.filter((p) => p.id !== current?.problemId);
  const fresh = others.filter((p) => p.topic !== current?.topic);
  const choices = fresh.length > 0 ? fresh : others.length > 0 ? others : pool;
  let best: PickableProblem | undefined;
  for (const p of choices) {
    if (!best || lastSeen(p, cards, session) < lastSeen(best, cards, session)) best = p;
  }
  return best ? { problemId: best.id, reason: { kind: 'extra' } } : null;
}

/**
 * Chooses the next problem. Mixes topics on purpose, never repeats the last topic while
 * another is available, and brings back due reviews. Pure and deterministic for a seeded rng.
 */
export function pickNext(input: PickInput): PickResult | null {
  const all = candidates(input);
  if (all.length === 0) return extraPractice(input);
  const topicCount = new Set(all.map((c) => c.problem.topic)).size;
  const last = topicAgo(input.session, 1);
  const varied = all.filter((c) => c.problem.topic !== last);
  const pool = varied.length > 0 ? varied : all;

  const reviews = pool.filter((c) => c.slot === 'review');
  const fresh = pool.filter((c) => c.slot === 'new');
  const wantReview = reviews.length > 0 && input.rng() < REVIEW_PROBABILITY;
  const slot = wantReview ? reviews : fresh.length > 0 ? fresh : reviews;

  const choice = weightedChoice(
    slot.map((c) => ({ item: c, weight: score(c, input, topicCount) })),
    input.rng,
  );
  return choice ? { problemId: choice.problem.id, reason: choice.reason } : null;
}
