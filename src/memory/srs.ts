import { hashString, mulberry32 } from '../lib/random';
import { addDays, daysBetween, endOfLocalDay, startOfLocalDay } from '../lib/time';
import type { CardState, Outcome, Quality } from './schema';

export const EASE_START = 2.5;
export const EASE_MIN = 1.3;
export const EASE_MAX = 2.8;
export const LAPSE_EASE_DROP = 0.2;
export const FUZZ = 0.1;
export const FUZZ_FROM_DAYS = 3;

export interface ReviewInput {
  readonly problemId: string;
  readonly outcome: Outcome;
  readonly quality: Quality;
  readonly now: number;
  /** A same-session retry after a miss. It never adds a second lapse. */
  readonly relearn?: boolean;
  /** Seed for the interval fuzz. Defaults to a hash of the card's id and history. */
  readonly seed?: number;
}

const clampEase = (e: number): number => Math.min(EASE_MAX, Math.max(EASE_MIN, e));

export function newCard(problemId: string, now: number): CardState {
  return {
    problemId,
    ease: EASE_START,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    dueAt: startOfLocalDay(now),
    lastSeenAt: now,
    lastOutcome: 'skipped',
  };
}

/** A factor in [1 - FUZZ, 1 + FUZZ], fully determined by the seed. */
export function fuzzFactor(seed: number): number {
  return 1 + (mulberry32(seed)() * 2 - 1) * FUZZ;
}

export function fuzzInterval(days: number, seed: number): number {
  if (days < FUZZ_FROM_DAYS) return days;
  return Math.max(1, Math.round(days * fuzzFactor(seed)));
}

/** Due at the start of the local day `days` after `now`. */
export function dueDate(now: number, days: number): number {
  return addDays(startOfLocalDay(now), days);
}

/**
 * SM-2 update. Returns the card unchanged for a skip (or undefined if there was no card).
 */
export function reviewCard(card: CardState | undefined, input: ReviewInput): CardState | undefined {
  if (input.outcome === 'skipped') return card;
  const prev = card ?? newCard(input.problemId, input.now);
  const q = input.quality;
  const seed = input.seed ?? hashString(`${prev.problemId}:${prev.reps}:${prev.lapses}`);
  const base = { ...prev, lastSeenAt: input.now, lastOutcome: input.outcome };

  if (q < 3) {
    const retry = input.relearn === true;
    return {
      ...base,
      reps: 0,
      lapses: retry ? prev.lapses : prev.lapses + 1,
      ease: retry ? prev.ease : clampEase(prev.ease - LAPSE_EASE_DROP),
      intervalDays: 1,
      dueAt: dueDate(input.now, 1),
    };
  }

  let interval: number;
  if (prev.reps === 0) interval = 1;
  else if (prev.reps === 1) interval = 3;
  else interval = Math.max(1, Math.round(prev.intervalDays * prev.ease));
  interval = fuzzInterval(interval, seed);
  const d = 5 - q;
  return {
    ...base,
    reps: prev.reps + 1,
    ease: clampEase(prev.ease + 0.1 - d * (0.08 + d * 0.02)),
    intervalDays: interval,
    dueAt: dueDate(input.now, interval),
  };
}

/** Day-level granularity: anything due today counts as due. */
export function isDue(card: CardState, now: number): boolean {
  return card.dueAt <= endOfLocalDay(now);
}

export function daysOverdue(card: CardState, now: number): number {
  return Math.max(0, daysBetween(card.dueAt, now));
}
