import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../lib/time';
import {
  applyAttemptToTopic,
  attemptScore,
  BAND_LABELS,
  bandOf,
  confidence,
  daysSinceSeen,
  decayedMastery,
  rebuildTopics,
} from './mastery';
import { emptyTopicStats, type TopicStats } from './schema';
import { makeAttempt, T0 } from './testing';

const stats = (overrides: Partial<TopicStats> = {}): TopicStats => ({
  ...emptyTopicStats('graphs'),
  ...overrides,
});

describe('confidence and score', () => {
  it('confidence = 1 - 0.75^n', () => {
    expect(confidence(0)).toBe(0);
    expect(confidence(1)).toBeCloseTo(0.25, 12);
    expect(confidence(2)).toBeCloseTo(0.4375, 12);
    expect(confidence(10)).toBeCloseTo(1 - 0.75 ** 10, 12);
  });

  it('score = (q/5) * difficulty weight', () => {
    expect(attemptScore(5, 5)).toBe(1);
    expect(attemptScore(5, 4)).toBeCloseTo(0.95, 12);
    expect(attemptScore(5, 3)).toBeCloseTo(0.85, 12);
    expect(attemptScore(4, 4)).toBeCloseTo(0.76, 12);
    expect(attemptScore(0, 5)).toBe(0);
  });
});

describe('applyAttemptToTopic', () => {
  it('updates the EMA and multiplies by confidence', () => {
    const one = applyAttemptToTopic(stats(), makeAttempt({ quality: 5, difficulty: 5 }));
    expect(one.attempts).toBe(1);
    expect(one.mastery).toBeCloseTo(0.3 * 0.25, 12);
    const two = applyAttemptToTopic(one, makeAttempt({ id: 'a2', quality: 5, difficulty: 5 }));
    expect(two.mastery).toBeCloseTo((0.7 * 0.3 + 0.3) * 0.4375, 12);
    const three = applyAttemptToTopic(
      two,
      makeAttempt({ id: 'a3', quality: 1, difficulty: 3, outcome: 'incorrect' }),
    );
    const ema3 = 0.7 * 0.51 + 0.3 * (1 / 5) * 0.85;
    expect(three.mastery).toBeCloseTo(ema3 * confidence(3), 12);
  });

  it('counts correct answers and averages time and hints', () => {
    let s = stats();
    s = applyAttemptToTopic(s, makeAttempt({ activeMs: 1000, hintsUsed: 2, agentHints: 1 }));
    s = applyAttemptToTopic(
      s,
      makeAttempt({ id: 'a2', activeMs: 3000, hintsUsed: 0, outcome: 'partial', quality: 2 }),
    );
    expect(s.attempts).toBe(2);
    expect(s.correct).toBe(1);
    expect(s.avgActiveMs).toBe(2000);
    expect(s.hintsPerAttempt).toBe(1.5);
    expect(s.topic).toBe('graphs');
  });

  it('a skip only updates lastSeenAt', () => {
    const before = stats({ attempts: 2, correct: 1, mastery: 0.3, lastSeenAt: T0 - DAY_MS });
    const after = applyAttemptToTopic(
      before,
      makeAttempt({ outcome: 'skipped', quality: 0, endedAt: T0 }),
    );
    expect(after).toEqual({ ...before, lastSeenAt: T0 });
  });

  it('keeps the later lastSeenAt when an older attempt arrives', () => {
    const s = applyAttemptToTopic(stats({ lastSeenAt: T0 }), makeAttempt({ endedAt: T0 - 5000 }));
    expect(s.lastSeenAt).toBe(T0);
  });

  it('stays within [0, 1] and approaches 1 with many perfect hard answers', () => {
    let s = stats();
    for (let i = 0; i < 60; i++) {
      s = applyAttemptToTopic(s, makeAttempt({ id: `a${i}`, quality: 5, difficulty: 5 }));
      expect(s.mastery).toBeGreaterThanOrEqual(0);
      expect(s.mastery).toBeLessThanOrEqual(1);
    }
    expect(s.mastery).toBeGreaterThan(0.99);
  });
});

describe('rebuildTopics', () => {
  const attempts = [
    makeAttempt({ id: 'a3', endedAt: T0 + 3000, quality: 1, outcome: 'incorrect' }),
    makeAttempt({ id: 'a1', endedAt: T0 + 1000, quality: 5 }),
    makeAttempt({ id: 'a2', endedAt: T0 + 2000, quality: 4, topic: 'logic' }),
    makeAttempt({ id: 'a4', endedAt: T0 + 4000, quality: 0, outcome: 'skipped', topic: 'sets' }),
  ];

  it('folds attempts in time order, whatever the input order', () => {
    const topics = rebuildTopics(attempts);
    const a1 = attempts[1];
    const a3 = attempts[0];
    if (!a1 || !a3) throw new Error('fixture');
    const expected = applyAttemptToTopic(applyAttemptToTopic(stats(), a1), a3);
    expect(topics.graphs).toEqual(expected);
    expect(rebuildTopics([...attempts].reverse())).toEqual(topics);
  });

  it('covers every topic and leaves unpractised ones empty', () => {
    const topics = rebuildTopics(attempts);
    expect(Object.keys(topics)).toHaveLength(10);
    expect(topics.boolean).toEqual(emptyTopicStats('boolean'));
    expect(topics.sets).toEqual({ ...emptyTopicStats('sets'), lastSeenAt: T0 + 4000 });
    expect(topics.logic.attempts).toBe(1);
  });

  it('gives empty stats for no attempts', () => {
    const topics = rebuildTopics([]);
    for (const s of Object.values(topics)) expect(s).toEqual(emptyTopicStats(s.topic));
  });
});

describe('decay and days since seen', () => {
  it('halves mastery every 30 days', () => {
    const s = stats({ attempts: 5, mastery: 0.8, lastSeenAt: T0 });
    expect(decayedMastery(s, T0)).toBeCloseTo(0.8, 12);
    expect(decayedMastery(s, T0 + 30 * DAY_MS)).toBeCloseTo(0.4, 12);
    expect(decayedMastery(s, T0 + 60 * DAY_MS)).toBeCloseTo(0.2, 12);
    expect(decayedMastery(s, T0 + 15 * DAY_MS)).toBeCloseTo(0.8 * Math.SQRT1_2, 12);
  });

  it('is 0 for a topic never seen', () => {
    expect(decayedMastery(stats(), T0)).toBe(0);
  });

  it('daysSinceSeen is fractional, null if never seen, and never negative', () => {
    expect(daysSinceSeen(stats(), T0)).toBeNull();
    expect(daysSinceSeen(stats({ lastSeenAt: T0 }), T0 + 1.5 * DAY_MS)).toBeCloseTo(1.5, 12);
    expect(daysSinceSeen(stats({ lastSeenAt: T0 + DAY_MS }), T0)).toBe(0);
  });
});

describe('bands', () => {
  it.each([
    [0, 'new'],
    [0.2499, 'new'],
    [0.25, 'learning'],
    [0.4999, 'learning'],
    [0.5, 'steady'],
    [0.7499, 'steady'],
    [0.75, 'strong'],
    [1, 'strong'],
  ] as const)('%f -> %s', (m, band) => {
    expect(bandOf(m)).toBe(band);
  });

  it('has plain labels', () => {
    expect(BAND_LABELS).toEqual({
      new: 'New',
      learning: 'Learning',
      steady: 'Steady',
      strong: 'Strong',
    });
  });
});
