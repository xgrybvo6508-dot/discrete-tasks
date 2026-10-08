import { describe, expect, it } from 'vitest';
import { applyAttemptToTopic } from './mastery';
import { migrate } from './migrate';
import { emptyMemory, emptyTopicStats, MEMORY_VERSION } from './schema';
import { makeAttempt, T0 } from './testing';

describe('migrate', () => {
  it.each([undefined, null, { version: 0 }])('migrates v0 data to fresh memory', (raw) => {
    const result = migrate(raw, T0);

    expect(result).toEqual({ ok: true, value: emptyMemory(T0) });
  });

  it('reads current data and removes unknown fields', () => {
    const current = {
      ...emptyMemory(T0 - 1000),
      privateSetting: 'must not survive',
    };

    const result = migrate(current, T0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(emptyMemory(T0 - 1000));
    expect(result.value).not.toHaveProperty('privateSetting');
  });

  it('rejects data from a future version without changing it', () => {
    const future = { ...emptyMemory(T0), version: MEMORY_VERSION + 1 };
    const copy = structuredClone(future);

    const result = migrate(future, T0 + 1000);

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'future-version',
        message: 'Saved data comes from a newer version of the app.',
        details: [`version ${MEMORY_VERSION + 1}`],
      },
    });
    expect(future).toEqual(copy);
  });

  it.each([
    ['a primitive', 'broken'],
    ['a missing version', {}],
    ['an invalid attempt', { ...emptyMemory(T0), attempts: [{ id: 'incomplete' }] }],
    ['an invalid card', { ...emptyMemory(T0), cards: { 'graph-001': { problemId: 'graph-001' } } }],
  ])('rejects corrupt current data: %s', (_label, raw) => {
    const result = migrate(raw, T0);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('corrupt');
    expect(result.error.message).toBe('Saved data could not be read.');
    expect(result.error.details.length).toBeGreaterThan(0);
  });

  it('rebuilds all topic statistics from attempts instead of trusting the cache', () => {
    const attempt = makeAttempt({ hintsUsed: 2, activeMs: 12_000 });
    const raw = {
      ...emptyMemory(T0 - 1000),
      attempts: [attempt],
      topics: {
        graphs: {
          ...emptyTopicStats('graphs'),
          attempts: 999,
          correct: 999,
          mastery: 1,
        },
      },
    };

    const result = migrate(raw, T0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.topics.graphs).toEqual(
      applyAttemptToTopic(emptyTopicStats('graphs'), attempt),
    );
    expect(Object.keys(result.value.topics)).toHaveLength(10);
    expect(result.value.topics.logic).toEqual(emptyTopicStats('logic'));
  });
});
