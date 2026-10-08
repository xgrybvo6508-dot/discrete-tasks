import { describe, expect, it } from 'vitest';
import {
  addDays,
  createFakeClock,
  DAY_MS,
  daysBetween,
  endOfLocalDay,
  MINUTE_MS,
  startOfLocalDay,
  systemClock,
} from './time';

const at = (y: number, m: number, d: number, h = 0, min = 0): number =>
  new Date(y, m, d, h, min).getTime();

describe('fake clock', () => {
  it('starts at the given time and moves only when told', () => {
    const clock = createFakeClock(1000);
    expect(clock.now()).toBe(1000);
    expect(clock.now()).toBe(1000);
    clock.advance(5 * MINUTE_MS);
    expect(clock.now()).toBe(1000 + 300_000);
    clock.set(42);
    expect(clock.now()).toBe(42);
  });

  it('systemClock reads the real time', () => {
    const before = Date.now();
    const t = systemClock.now();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(Date.now());
  });

  it('has the expected constants', () => {
    expect(MINUTE_MS).toBe(60_000);
    expect(DAY_MS).toBe(24 * 60 * MINUTE_MS);
  });
});

describe('startOfLocalDay and endOfLocalDay', () => {
  it('return the first and last millisecond of the local day', () => {
    const t = at(2026, 9, 8, 15, 30);
    expect(startOfLocalDay(t)).toBe(at(2026, 9, 8));
    expect(endOfLocalDay(t)).toBe(at(2026, 9, 9) - 1);
  });

  it('are stable at the edges of the day', () => {
    const start = at(2026, 9, 8);
    expect(startOfLocalDay(start)).toBe(start);
    expect(endOfLocalDay(start)).toBe(at(2026, 9, 9) - 1);
    const end = at(2026, 9, 9) - 1;
    expect(startOfLocalDay(end)).toBe(start);
    expect(endOfLocalDay(end)).toBe(end);
    expect(startOfLocalDay(end + 1)).toBe(end + 1);
  });

  it('handle month and year ends', () => {
    expect(endOfLocalDay(at(2026, 11, 31, 12))).toBe(at(2027, 0, 1) - 1);
    expect(startOfLocalDay(at(2028, 1, 29, 23))).toBe(at(2028, 1, 29));
  });

  it('end of day is the start of the next day minus 1 ms, even around DST changes', () => {
    for (let day = 0; day < 366; day++) {
      const noon = at(2026, 0, 1 + day, 12);
      expect(endOfLocalDay(noon) + 1).toBe(startOfLocalDay(addDays(noon, 1)));
    }
  });
});

describe('addDays', () => {
  it('adds whole days and keeps the local time', () => {
    const d = new Date(addDays(at(2026, 9, 8, 15, 30), 3));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([
      2026, 9, 11, 15, 30,
    ]);
  });

  it('crosses month and year boundaries and goes backwards', () => {
    expect(addDays(at(2026, 11, 30, 9), 3)).toBe(at(2027, 0, 2, 9));
    expect(addDays(at(2026, 2, 1, 9), -1)).toBe(at(2026, 1, 28, 9));
    expect(addDays(at(2026, 9, 8, 9), 0)).toBe(at(2026, 9, 8, 9));
  });

  it('keeps the local hour on every day of the year', () => {
    for (let day = 0; day < 366; day++) {
      const d = new Date(addDays(at(2026, 0, 1, 12), day));
      expect(d.getHours()).toBe(12);
      expect(d.getTime()).toBe(at(2026, 0, 1 + day, 12));
    }
  });
});

describe('daysBetween', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    expect(daysBetween(at(2026, 9, 8, 23, 59), at(2026, 9, 9, 0, 1))).toBe(1);
    expect(daysBetween(at(2026, 9, 8, 0, 0), at(2026, 9, 8, 23, 59))).toBe(0);
  });

  it('is negative when the second time is earlier', () => {
    expect(daysBetween(at(2026, 9, 9), at(2026, 9, 8))).toBe(-1);
  });

  it('works across months, leap years and a whole year', () => {
    expect(daysBetween(at(2028, 1, 28), at(2028, 2, 1))).toBe(2);
    expect(daysBetween(at(2026, 0, 1), at(2027, 0, 1))).toBe(365);
    expect(daysBetween(at(2028, 0, 1), at(2029, 0, 1))).toBe(366);
  });

  it('agrees with addDays on every day of the year', () => {
    const start = at(2026, 0, 1, 8);
    for (let day = 0; day < 366; day++) {
      expect(daysBetween(start, addDays(start, day))).toBe(day);
    }
  });

  it('works with a fake clock', () => {
    const clock = createFakeClock(at(2026, 9, 8, 22));
    const first = clock.now();
    clock.advance(3 * 60 * MINUTE_MS);
    expect(daysBetween(first, clock.now())).toBe(1);
    clock.advance(DAY_MS);
    expect(daysBetween(first, clock.now())).toBe(2);
  });
});
