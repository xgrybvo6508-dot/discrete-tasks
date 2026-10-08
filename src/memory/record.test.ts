import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../lib/time';
import { applyAttemptToTopic } from './mastery';
import { addAiProblem, createAttempt, getCard, MAX_UNATTEMPTED_AI, recordAttempt } from './record';
import { emptyMemory, MAX_ANSWER_TEXT, type Memory } from './schema';
import { reviewCard } from './srs';
import { makeAiProblem, makeAttempt, makeAttemptInput, makeProblem, T0 } from './testing';

describe('createAttempt', () => {
  it('computes quality from the attempt', () => {
    expect(createAttempt('x', makeAttemptInput()).quality).toBe(5);
    expect(createAttempt('x', makeAttemptInput({ wrongChecks: 1, hintsUsed: 1 })).quality).toBe(3);
    expect(createAttempt('x', makeAttemptInput({ outcome: 'incorrect' })).quality).toBe(1);
  });

  it('uses estMinutes for the time penalty but does not store it', () => {
    const slow = makeAttemptInput({ activeMs: 25 * 60_000, estMinutes: 10 });
    const a = createAttempt('x', slow);
    expect(a.quality).toBe(4);
    expect(a).not.toHaveProperty('estMinutes');
    expect(a.id).toBe('x');
  });

  it('caps answerText', () => {
    const a = createAttempt(
      'x',
      makeAttemptInput({ answerText: 'y'.repeat(MAX_ANSWER_TEXT + 50) }),
    );
    expect(a.answerText).toHaveLength(MAX_ANSWER_TEXT);
    expect(createAttempt('x', makeAttemptInput())).not.toHaveProperty('answerText');
  });
});

describe('recordAttempt', () => {
  it('adds the attempt and updates card, topic and updatedAt', () => {
    const m0 = emptyMemory(T0 - DAY_MS);
    const a = makeAttempt();
    const m1 = recordAttempt(m0, a);
    expect(m1.attempts).toEqual([a]);
    expect(m1.cards['graph-001']).toEqual(
      reviewCard(undefined, { problemId: 'graph-001', outcome: 'correct', quality: 5, now: T0 }),
    );
    expect(m1.topics.graphs).toEqual(applyAttemptToTopic(m0.topics.graphs, a));
    expect(m1.updatedAt).toBe(T0);
  });

  it('is pure: the input memory is not changed', () => {
    const m0 = recordAttempt(emptyMemory(T0), makeAttempt({ id: 'a0' }));
    const copy = structuredClone(m0);
    recordAttempt(m0, makeAttempt({ id: 'a1', endedAt: T0 + DAY_MS }));
    expect(m0).toEqual(copy);
  });

  it('ignores an attempt id it already has', () => {
    const m1 = recordAttempt(emptyMemory(T0), makeAttempt());
    expect(recordAttempt(m1, makeAttempt({ outcome: 'incorrect', quality: 1 }))).toBe(m1);
  });

  it('a skip creates no card but updates topic lastSeenAt', () => {
    const skip = makeAttempt({ outcome: 'skipped', quality: 0 });
    const m = recordAttempt(emptyMemory(T0 - DAY_MS), skip);
    expect(m.cards).toEqual({});
    expect(m.attempts).toEqual([skip]);
    expect(m.topics.graphs.lastSeenAt).toBe(T0);
    expect(m.topics.graphs.attempts).toBe(0);
  });

  it('a skip leaves an existing card unchanged', () => {
    const m1 = recordAttempt(emptyMemory(T0), makeAttempt());
    const skip = makeAttempt({ id: 'a2', outcome: 'skipped', quality: 0, endedAt: T0 + DAY_MS });
    const m2 = recordAttempt(m1, skip);
    expect(m2.cards['graph-001']).toEqual(m1.cards['graph-001']);
  });

  it('passes relearn and seed to the scheduler', () => {
    const m1 = recordAttempt(emptyMemory(T0), makeAttempt({ outcome: 'incorrect', quality: 1 }));
    const retry = makeAttempt({ id: 'a2', outcome: 'incorrect', quality: 1, endedAt: T0 + 60_000 });
    expect(recordAttempt(m1, retry, { relearn: true }).cards['graph-001']?.lapses).toBe(1);
    expect(recordAttempt(m1, retry).cards['graph-001']?.lapses).toBe(2);

    const base = recordAttempt(
      recordAttempt(emptyMemory(T0), makeAttempt({ id: 'b1' })),
      makeAttempt({ id: 'b2', endedAt: T0 + DAY_MS }),
    );
    const third = makeAttempt({ id: 'b3', endedAt: T0 + 4 * DAY_MS });
    const card = recordAttempt(base, third, { seed: 99 }).cards['graph-001'];
    expect(card).toEqual(
      reviewCard(base.cards['graph-001'], {
        problemId: 'graph-001',
        outcome: 'correct',
        quality: 5,
        now: third.endedAt,
        seed: 99,
      }),
    );
  });

  it('never stores a card under an unsafe key', () => {
    for (const problemId of ['__proto__', 'constructor', 'prototype']) {
      const m = recordAttempt(emptyMemory(T0), makeAttempt({ problemId }));
      expect(Object.keys(m.cards)).toEqual([]);
      expect(Object.getPrototypeOf(m.cards)).toBe(Object.prototype);
      expect(m.attempts).toHaveLength(1);
    }
  });
});

describe('getCard', () => {
  it('reads own properties only', () => {
    const m = recordAttempt(emptyMemory(T0), makeAttempt());
    expect(getCard(m.cards, 'graph-001')?.problemId).toBe('graph-001');
    for (const id of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'missing']) {
      expect(getCard(m.cards, id)).toBeUndefined();
    }
  });
});

describe('addAiProblem', () => {
  const withAttemptOn = (m: Memory, problemId: string, id: string): Memory =>
    recordAttempt(m, makeAttempt({ id, problemId, source: 'ai' }));

  it('adds AI problems once and ignores bank problems', () => {
    let m = addAiProblem(emptyMemory(T0), makeAiProblem(1));
    expect(m.aiProblems.map((p) => p.id)).toEqual(['ai-graph-1']);
    expect(addAiProblem(m, makeAiProblem(1, { title: 'Other' }))).toBe(m);
    m = addAiProblem(m, makeProblem());
    expect(m.aiProblems).toHaveLength(1);
  });

  it(`keeps at most ${MAX_UNATTEMPTED_AI} unattempted problems, dropping the oldest`, () => {
    let m = emptyMemory(T0);
    for (let i = 1; i <= 25; i++) m = addAiProblem(m, makeAiProblem(i));
    expect(m.aiProblems).toHaveLength(MAX_UNATTEMPTED_AI);
    expect(m.aiProblems[0]?.id).toBe(makeAiProblem(6).id);
    expect(m.aiProblems.at(-1)?.id).toBe(makeAiProblem(25).id);
  });

  it('never prunes problems that have attempts', () => {
    let m = emptyMemory(T0);
    for (let i = 1; i <= 3; i++) m = addAiProblem(m, makeAiProblem(i));
    m = withAttemptOn(m, makeAiProblem(1).id, 'x1');
    m = withAttemptOn(m, makeAiProblem(2).id, 'x2');
    for (let i = 4; i <= 10; i++) m = addAiProblem(m, makeAiProblem(i), 2);
    const ids = m.aiProblems.map((p) => p.id);
    expect(ids).toEqual([
      makeAiProblem(1).id,
      makeAiProblem(2).id,
      makeAiProblem(9).id,
      makeAiProblem(10).id,
    ]);
  });

  it('is pure', () => {
    const m0 = addAiProblem(emptyMemory(T0), makeAiProblem(1));
    const copy = structuredClone(m0);
    addAiProblem(m0, makeAiProblem(2), 1);
    expect(m0).toEqual(copy);
  });
});
