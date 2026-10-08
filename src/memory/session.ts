import type { Topic } from '../bank/types';
import { getCard } from './record';
import type { CardState, Outcome } from './schema';

/** Number of other problems that must come between a miss and its retry. */
export const RELEARN_GAP = 4;

export interface Presented {
  readonly problemId: string;
  readonly topic: Topic;
}

export interface RelearnItem {
  readonly problemId: string;
  readonly topic: Topic;
  /** `presented.length` right after the miss. */
  readonly queuedAt: number;
}

/** In-memory state of one practice session. Never persisted. */
export interface SessionState {
  readonly startedAt: number;
  readonly presented: readonly Presented[];
  readonly relearn: readonly RelearnItem[];
  /** Problems already retried this session (each gets one retry). */
  readonly retried: readonly string[];
  readonly focusTopic: Topic | null;
}

export function createSession(now: number, focusTopic: Topic | null = null): SessionState {
  return { startedAt: now, presented: [], relearn: [], retried: [], focusTopic };
}

export function setFocus(session: SessionState, focusTopic: Topic | null): SessionState {
  return { ...session, focusTopic };
}

/** Records that a problem is now on screen. A queued retry moves to `retried`. */
export function presentProblem(session: SessionState, problem: Presented): SessionState {
  const queued = session.relearn.some((r) => r.problemId === problem.problemId);
  return {
    ...session,
    presented: [...session.presented, { problemId: problem.problemId, topic: problem.topic }],
    relearn: queued
      ? session.relearn.filter((r) => r.problemId !== problem.problemId)
      : session.relearn,
    retried: queued ? [...session.retried, problem.problemId] : session.retried,
  };
}

/** After a miss, the problem may come back once later in the session. */
export function noteOutcome(
  session: SessionState,
  problem: Presented,
  outcome: Outcome,
): SessionState {
  if (outcome !== 'incorrect') return session;
  const known =
    session.retried.includes(problem.problemId) ||
    session.relearn.some((r) => r.problemId === problem.problemId);
  if (known) return session;
  const item = {
    problemId: problem.problemId,
    topic: problem.topic,
    queuedAt: session.presented.length,
  };
  return { ...session, relearn: [...session.relearn, item] };
}

/** True if the attempt on this problem is a same-session retry. */
export const isRetry = (session: SessionState, problemId: string): boolean =>
  session.retried.includes(problemId);

export function seenIds(session: SessionState): ReadonlySet<string> {
  return new Set(session.presented.map((p) => p.problemId));
}

export function eligibleRelearn(session: SessionState): RelearnItem[] {
  return session.relearn.filter((r) => session.presented.length - r.queuedAt >= RELEARN_GAP);
}

/** Topic of the problem `back` steps ago (1 = the last one). */
export function topicAgo(session: SessionState, back: number): Topic | null {
  return session.presented.at(-back)?.topic ?? null;
}

export interface SessionSummary {
  readonly seen: number;
  readonly topics: readonly Topic[];
  /** Problems from this session that will come back, soonest first. */
  readonly comingBack: readonly { problemId: string; dueAt: number }[];
}

export function summarizeSession(
  session: SessionState,
  cards: Readonly<Record<string, CardState>>,
): SessionSummary {
  const ids = [...seenIds(session)];
  const topics = [...new Set(session.presented.map((p) => p.topic))];
  const comingBack = ids
    .map((id) => getCard(cards, id))
    .filter((c): c is CardState => c !== undefined)
    .map((c) => ({ problemId: c.problemId, dueAt: c.dueAt }))
    .sort((a, b) => a.dueAt - b.dueAt || a.problemId.localeCompare(b.problemId));
  return { seen: ids.length, topics, comingBack };
}
