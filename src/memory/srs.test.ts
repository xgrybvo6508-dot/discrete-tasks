import { describe, expect, it } from 'vitest';
import { createFakeClock, DAY_MS } from '../lib/time';
import type { CardState, Quality } from './schema';
import {
  daysOverdue,
  dueDate,
  EASE_MAX,
  EASE_MIN,
  EASE_START,
  fuzzFactor,
  fuzzInterval,
  isDue,
  newCard,
  reviewCard,
  type ReviewInput,
} from './srs';

const local = (y: number, m: number, d: number, h = 0, min = 0): number =>
  new Date(y, m, d, h, min).getTime();
const NOW = local(2026, 9, 8, 12);

function card(overrides: Partial<CardState> = {}): CardState {
  return {
    problemId: 'p',
    ease: EASE_START,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    dueAt: NOW,
    lastSeenAt: NOW,
    lastOutcome: 'correct',
    ...overrides,
  };
}

function review(
  c: CardState | undefined,
  quality: Quality,
  overrides: Partial<ReviewInput> = {},
): CardState {
  const out = reviewCard(c, {
    problemId: 'p',
    outcome: quality >= 3 ? 'correct' : 'incorrect',
    quality,
    now: NOW,
    seed: 42,
    ...overrides,
  });
  if (!out) throw new Error('expected a card');
  return out;
}

describe('reviewCard: correct answers', () => {
  it('creates a card on the first review: interval 1 day, due tomorrow', () => {
    const c = review(undefined, 5);
    expect(c).toEqual({
      problemId: 'p',
      ease: 2.6,
      intervalDays: 1,
      reps: 1,
      lapses: 0,
      dueAt: local(2026, 9, 9),
      lastSeenAt: NOW,
      lastOutcome: 'correct',
    });
  });

  it('follows the interval sequence 1, 3, then interval x old ease (with seeded fuzz)', () => {
    const first = review(undefined, 4);
    expect(first.intervalDays).toBe(1);
    const second = review(first, 4);
    expect(second.intervalDays).toBe(3);
    expect(second.ease).toBeCloseTo(2.5);
    const third = review(second, 4, { seed: 7 });
    expect(third.intervalDays).toBe(fuzzInterval(Math.round(3 * 2.5), 7));
    const fourth = review(third, 4, { seed: 9 });
    expect(fourth.intervalDays).toBe(fuzzInterval(Math.round(third.intervalDays * 2.5), 9));
    expect([first, second, third, fourth].map((c) => c.reps)).toEqual([1, 2, 3, 4]);
  });

  it('uses the ease from before this review to grow the interval', () => {
    const c = card({ reps: 2, intervalDays: 10, ease: 2 });
    const next = review(c, 3, { seed: 1 });
    expect(next.intervalDays).toBe(fuzzInterval(20, 1));
    expect(next.ease).toBeCloseTo(1.86);
  });

  it.each([
    [5, 0.1],
    [4, 0],
    [3, -0.14],
  ] as const)('quality %i changes ease by %f', (quality, delta) => {
    const next = review(card({ ease: 2 }), quality);
    expect(next.ease).toBeCloseTo(2 + delta, 10);
  });

  it('puts dueAt at the start of the local day interval days ahead', () => {
    const next = review(card({ reps: 1, intervalDays: 1 }), 5);
    expect(next.intervalDays).toBe(3);
    expect(next.dueAt).toBe(local(2026, 9, 11));
  });
});

describe('reviewCard: lapses', () => {
  it.each([0, 1, 2] as const)('quality %i resets reps and interval and lowers ease', (quality) => {
    const c = card({ reps: 4, intervalDays: 20, ease: 2.5, lapses: 1 });
    const next = review(c, quality);
    expect(next.reps).toBe(0);
    expect(next.lapses).toBe(2);
    expect(next.intervalDays).toBe(1);
    expect(next.ease).toBeCloseTo(2.3, 10);
    expect(next.dueAt).toBe(local(2026, 9, 9));
    expect(next.lastOutcome).toBe('incorrect');
  });

  it('starts again at 1, then 3 after a lapse', () => {
    const lapsed = review(card({ reps: 4, intervalDays: 20 }), 1);
    const a = review(lapsed, 5);
    const b = review(a, 5);
    expect([lapsed.intervalDays, a.intervalDays, b.intervalDays]).toEqual([1, 1, 3]);
  });

  it('a relearn miss in the same session adds no lapse and keeps ease', () => {
    const c = card({ reps: 0, intervalDays: 1, ease: 2.3, lapses: 1 });
    const next = review(c, 1, { relearn: true });
    expect(next.lapses).toBe(1);
    expect(next.ease).toBe(2.3);
    expect(next.reps).toBe(0);
    expect(next.intervalDays).toBe(1);
  });

  it('a first-ever miss creates a card with one lapse', () => {
    const c = review(undefined, 1);
    expect(c.lapses).toBe(1);
    expect(c.ease).toBeCloseTo(2.3, 10);
  });
});

describe('reviewCard: ease bounds', () => {
  it('never goes above the maximum', () => {
    expect(review(card({ ease: 2.75 }), 5).ease).toBe(EASE_MAX);
    let c = card();
    for (let i = 0; i < 20; i++) c = review(c, 5, { seed: i });
    expect(c.ease).toBe(EASE_MAX);
  });

  it('never goes below the minimum', () => {
    expect(review(card({ ease: 1.4 }), 0).ease).toBe(EASE_MIN);
    expect(review(card({ ease: 1.35, reps: 2, intervalDays: 3 }), 3).ease).toBe(EASE_MIN);
    let c = card();
    for (let i = 0; i < 20; i++) c = review(c, i % 2 === 0 ? 0 : 3);
    expect(c.ease).toBe(EASE_MIN);
  });
});

describe('reviewCard: skips', () => {
  it('returns the same card for a skip', () => {
    const c = card({ reps: 3 });
    expect(reviewCard(c, { problemId: 'p', outcome: 'skipped', quality: 0, now: NOW })).toBe(c);
  });

  it('returns undefined for a skip with no card', () => {
    expect(
      reviewCard(undefined, { problemId: 'p', outcome: 'skipped', quality: 0, now: NOW }),
    ).toBeUndefined();
  });
});

describe('fuzz', () => {
  it('is deterministic for a seed', () => {
    expect(fuzzFactor(123)).toBe(fuzzFactor(123));
    expect(fuzzInterval(30, 5)).toBe(fuzzInterval(30, 5));
    const c = card({ reps: 3, intervalDays: 10 });
    const input = { problemId: 'p', outcome: 'correct', quality: 5, now: NOW } as const;
    expect(reviewCard(c, input)).toEqual(reviewCard(c, input));
  });

  it('stays within +-10% over many seeds and actually varies', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 5000; seed++) {
      const f = fuzzFactor(seed);
      expect(f).toBeGreaterThanOrEqual(0.9);
      expect(f).toBeLessThanOrEqual(1.1);
      const days = fuzzInterval(30, seed);
      expect(days).toBeGreaterThanOrEqual(27);
      expect(days).toBeLessThanOrEqual(33);
      seen.add(days);
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it('does not fuzz intervals under 3 days and keeps 3 days at 3', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(fuzzInterval(1, seed)).toBe(1);
      expect(fuzzInterval(2, seed)).toBe(2);
      expect(fuzzInterval(3, seed)).toBe(3);
    }
  });
});

describe('due dates on local day boundaries (fake clock)', () => {
  it('a card reviewed at 23:59 is due from the next local midnight', () => {
    const clock = createFakeClock(local(2026, 9, 8, 23, 59));
    const c = review(undefined, 5, { now: clock.now() });
    expect(c.dueAt).toBe(local(2026, 9, 9));
    expect(isDue(c, clock.now())).toBe(false);

    clock.set(local(2026, 9, 9, 0, 0));
    expect(isDue(c, clock.now())).toBe(true);
    clock.set(local(2026, 9, 9, 23, 59));
    expect(isDue(c, clock.now())).toBe(true);
    clock.advance(3 * DAY_MS);
    expect(isDue(c, clock.now())).toBe(true);
  });

  it('a card reviewed just after midnight is still due only on the next local day', () => {
    const clock = createFakeClock(local(2026, 9, 8, 0, 1));
    const c = review(undefined, 5, { now: clock.now() });
    clock.set(local(2026, 9, 8, 23, 59));
    expect(isDue(c, clock.now())).toBe(false);
    clock.set(local(2026, 9, 9, 0, 0));
    expect(isDue(c, clock.now())).toBe(true);
  });

  it('a card due later today counts as due now (day granularity)', () => {
    const c = card({ dueAt: local(2026, 9, 8, 22) });
    expect(isDue(c, local(2026, 9, 8, 6))).toBe(true);
    expect(isDue(c, local(2026, 9, 7, 23, 59))).toBe(false);
  });

  it('dueDate adds whole local days from the start of today', () => {
    expect(dueDate(local(2026, 9, 8, 17, 30), 0)).toBe(local(2026, 9, 8));
    expect(dueDate(local(2026, 9, 8, 17, 30), 1)).toBe(local(2026, 9, 9));
    expect(dueDate(local(2026, 9, 30, 9), 3)).toBe(local(2026, 10, 2));
    expect(dueDate(local(2026, 11, 31, 9), 1)).toBe(local(2027, 0, 1));
    expect(dueDate(local(2026, 2, 28, 12), 2)).toBe(local(2026, 2, 30));
  });

  it('a new card is due today', () => {
    expect(isDue(newCard('p', NOW), NOW)).toBe(true);
  });

  it('daysOverdue counts whole local days and is never negative', () => {
    const c = card({ dueAt: local(2026, 9, 5) });
    expect(daysOverdue(c, local(2026, 9, 8, 23))).toBe(3);
    expect(daysOverdue(c, local(2026, 9, 5, 8))).toBe(0);
    expect(daysOverdue(c, local(2026, 9, 1))).toBe(0);
  });
});
