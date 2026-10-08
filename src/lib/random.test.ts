import { describe, expect, it } from 'vitest';
import {
  hashString,
  mulberry32,
  randomInt,
  weightedChoice,
  type Rng,
  type Weighted,
} from './random';

const take = (rng: Rng, k: number): number[] => Array.from({ length: k }, () => rng());

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    expect(take(mulberry32(42), 20)).toEqual(take(mulberry32(42), 20));
  });

  it('different seeds give different sequences', () => {
    expect(take(mulberry32(1), 5)).not.toEqual(take(mulberry32(2), 5));
  });

  it('treats seeds as 32-bit unsigned', () => {
    expect(take(mulberry32(-1), 5)).toEqual(take(mulberry32(0xffffffff), 5));
  });

  it('stays in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 10_000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('hashString', () => {
  it('matches FNV-1a 32-bit', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('a')).toBe(0xe40c292c);
    expect(hashString('foobar')).toBe(0xbf9cf968);
  });

  it('is stable and spreads similar strings', () => {
    expect(hashString('graphs-01')).toBe(hashString('graphs-01'));
    expect(hashString('graphs-01')).not.toBe(hashString('graphs-02'));
  });
});

describe('randomInt', () => {
  it('is a whole number in [0, n)', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 1000; i++) {
      const k = randomInt(rng, 7);
      expect(Number.isInteger(k)).toBe(true);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(7);
    }
  });

  it('stays below n even if the rng returns its maximum', () => {
    expect(randomInt(() => 0.9999999999999999, 10)).toBe(9);
    expect(randomInt(() => 0, 10)).toBe(0);
  });

  it('is roughly uniform over 10k seeded draws', () => {
    const rng = mulberry32(2026);
    const counts = new Array<number>(10).fill(0);
    for (let i = 0; i < 10_000; i++) {
      const k = randomInt(rng, 10);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    for (const c of counts) expect(Math.abs(c - 1000)).toBeLessThan(120);
  });
});

describe('weightedChoice', () => {
  it('returns undefined for an empty list', () => {
    expect(weightedChoice([], mulberry32(1))).toBeUndefined();
  });

  it('returns undefined when no weight is positive and finite', () => {
    const options = [
      { item: 'a', weight: 0 },
      { item: 'b', weight: -3 },
      { item: 'c', weight: NaN },
      { item: 'd', weight: Infinity },
    ];
    expect(weightedChoice(options, mulberry32(1))).toBeUndefined();
  });

  it('never picks zero, negative or NaN weights', () => {
    const rng = mulberry32(9);
    const options = [
      { item: 'zero', weight: 0 },
      { item: 'ok', weight: 1 },
      { item: 'neg', weight: -5 },
      { item: 'nan', weight: NaN },
      { item: 'inf', weight: Infinity },
    ];
    for (let i = 0; i < 1000; i++) expect(weightedChoice(options, rng)).toBe('ok');
  });

  it('handles the edges of the rng range', () => {
    const options = [
      { item: 'a', weight: 1 },
      { item: 'b', weight: 1 },
    ];
    expect(weightedChoice(options, () => 0)).toBe('a');
    expect(weightedChoice(options, () => 0.9999999999999999)).toBe('b');
  });

  it('follows the weights over 10k seeded draws', () => {
    const rng = mulberry32(12345);
    const options: Weighted<'a' | 'b' | 'c'>[] = [
      { item: 'a', weight: 1 },
      { item: 'b', weight: 2 },
      { item: 'c', weight: 7 },
    ];
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 10_000; i++) {
      const pick = weightedChoice(options, rng);
      if (pick === undefined) throw new Error('expected a pick');
      counts[pick]++;
    }
    expect(counts.a / 10_000).toBeCloseTo(0.1, 1);
    expect(counts.b / 10_000).toBeCloseTo(0.2, 1);
    expect(counts.c / 10_000).toBeCloseTo(0.7, 1);
    expect(Math.abs(counts.a - 1000)).toBeLessThan(120);
    expect(Math.abs(counts.c - 7000)).toBeLessThan(200);
  });

  it('is deterministic with a seed', () => {
    const options = [
      { item: 1, weight: 0.3 },
      { item: 2, weight: 0.7 },
    ];
    const run = (): (number | undefined)[] => {
      const rng = mulberry32(77);
      return Array.from({ length: 50 }, () => weightedChoice(options, rng));
    };
    expect(run()).toEqual(run());
  });
});
