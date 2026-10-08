import { describe, expect, it } from 'vitest';
import { newId } from './ids';
import { mulberry32 } from './random';

describe('newId', () => {
  it('is 10 base36 characters by default', () => {
    expect(newId(mulberry32(1))).toMatch(/^[0-9a-z]{10}$/);
  });

  it('respects the requested length', () => {
    expect(newId(mulberry32(1), 4)).toHaveLength(4);
    expect(newId(mulberry32(1), 0)).toBe('');
    expect(newId(mulberry32(1), 32)).toMatch(/^[0-9a-z]{32}$/);
  });

  it('is deterministic with a seeded rng', () => {
    expect(newId(mulberry32(99))).toBe(newId(mulberry32(99)));
    expect(newId(mulberry32(99))).not.toBe(newId(mulberry32(100)));
  });

  it('maps the rng range to the whole alphabet', () => {
    expect(newId(() => 0, 3)).toBe('000');
    expect(newId(() => 0.9999999999999999, 3)).toBe('zzz');
  });

  it('gives no repeats over 10k ids from one rng', () => {
    const rng = mulberry32(5);
    const ids = new Set(Array.from({ length: 10_000 }, () => newId(rng)));
    expect(ids.size).toBe(10_000);
  });
});
