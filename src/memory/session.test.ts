import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../lib/time';
import { recordAttempt } from './record';
import { emptyMemory } from './schema';
import {
  createSession,
  eligibleRelearn,
  isRetry,
  noteOutcome,
  presentProblem,
  RELEARN_GAP,
  seenIds,
  setFocus,
  summarizeSession,
  topicAgo,
  type Presented,
  type SessionState,
} from './session';
import { makeAttempt, T0 } from './testing';

const P = (problemId: string, topic: Presented['topic'] = 'graphs'): Presented => ({
  problemId,
  topic,
});

function presentAll(session: SessionState, problems: readonly Presented[]): SessionState {
  return problems.reduce(presentProblem, session);
}

describe('createSession and setFocus', () => {
  it('starts empty, with an optional focus topic', () => {
    expect(createSession(T0)).toEqual({
      startedAt: T0,
      presented: [],
      relearn: [],
      retried: [],
      focusTopic: null,
    });
    expect(createSession(T0, 'logic').focusTopic).toBe('logic');
  });

  it('setFocus changes only the focus', () => {
    const s = presentProblem(createSession(T0), P('a'));
    const f = setFocus(s, 'sets');
    expect(f).toEqual({ ...s, focusTopic: 'sets' });
    expect(setFocus(f, null).focusTopic).toBeNull();
  });
});

describe('presentProblem, seenIds and topicAgo', () => {
  it('records problems in order', () => {
    const s = presentAll(createSession(T0), [P('a', 'graphs'), P('b', 'logic'), P('c', 'sets')]);
    expect([...seenIds(s)]).toEqual(['a', 'b', 'c']);
    expect(topicAgo(s, 1)).toBe('sets');
    expect(topicAgo(s, 2)).toBe('logic');
    expect(topicAgo(s, 3)).toBe('graphs');
    expect(topicAgo(s, 4)).toBeNull();
    expect(topicAgo(createSession(T0), 1)).toBeNull();
  });

  it('is pure', () => {
    const s = createSession(T0);
    presentProblem(s, P('a'));
    expect(s.presented).toEqual([]);
  });
});

describe('relearn queue', () => {
  it('only an incorrect outcome queues a retry', () => {
    const s = presentProblem(createSession(T0), P('a'));
    for (const outcome of ['correct', 'partial', 'skipped'] as const) {
      expect(noteOutcome(s, P('a'), outcome)).toBe(s);
    }
    expect(noteOutcome(s, P('a'), 'incorrect').relearn).toEqual([
      { problemId: 'a', topic: 'graphs', queuedAt: 1 },
    ]);
  });

  it(`becomes eligible only after ${RELEARN_GAP} other problems`, () => {
    let s = presentProblem(createSession(T0), P('a'));
    s = noteOutcome(s, P('a'), 'incorrect');
    for (let i = 1; i < RELEARN_GAP; i++) {
      s = presentProblem(s, P(`o${i}`, 'logic'));
      expect(eligibleRelearn(s)).toEqual([]);
    }
    s = presentProblem(s, P('o4', 'logic'));
    expect(eligibleRelearn(s).map((r) => r.problemId)).toEqual(['a']);
  });

  it('queues a problem once and retries it at most once per session', () => {
    let s = presentProblem(createSession(T0), P('a'));
    s = noteOutcome(s, P('a'), 'incorrect');
    expect(noteOutcome(s, P('a'), 'incorrect')).toBe(s);
    expect(isRetry(s, 'a')).toBe(false);

    s = presentAll(s, [P('b'), P('c'), P('d'), P('e'), P('a')]);
    expect(s.relearn).toEqual([]);
    expect(s.retried).toEqual(['a']);
    expect(isRetry(s, 'a')).toBe(true);
    expect(isRetry(s, 'b')).toBe(false);

    const after = noteOutcome(s, P('a'), 'incorrect');
    expect(after).toBe(s);
    expect(eligibleRelearn(presentAll(after, [P('f'), P('g'), P('h'), P('i')]))).toEqual([]);
  });
});

describe('summarizeSession', () => {
  it('counts unique problems and topics and lists cards soonest first', () => {
    let m = emptyMemory(T0);
    m = recordAttempt(
      m,
      makeAttempt({ id: '1', problemId: 'x', outcome: 'incorrect', quality: 1 }),
    );
    m = recordAttempt(m, makeAttempt({ id: '2', problemId: 'y', topic: 'logic' }));
    m = recordAttempt(m, makeAttempt({ id: '3', problemId: 'w', topic: 'logic' }));
    m = recordAttempt(
      m,
      makeAttempt({ id: '4', problemId: 'z', topic: 'sets', endedAt: T0 + 3 * DAY_MS }),
    );
    const s = presentAll(createSession(T0), [
      P('x'),
      P('y', 'logic'),
      P('skipped', 'sets'),
      P('z', 'sets'),
      P('w', 'logic'),
      P('x'),
    ]);
    const summary = summarizeSession(s, m.cards);
    expect(summary.seen).toBe(5);
    expect(summary.topics).toEqual(['graphs', 'logic', 'sets']);
    expect(summary.comingBack.map((c) => c.problemId)).toEqual(['w', 'x', 'y', 'z']);
    const dues = summary.comingBack.map((c) => c.dueAt);
    expect(dues).toEqual([...dues].sort((a, b) => a - b));
  });

  it('is empty for an empty session', () => {
    expect(summarizeSession(createSession(T0), {})).toEqual({
      seen: 0,
      topics: [],
      comingBack: [],
    });
  });
});
