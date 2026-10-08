import { describe, expect, it } from 'vitest';
import { err, ok, type Result } from './result';

describe('result', () => {
  it('ok wraps a value', () => {
    expect(ok(5)).toEqual({ ok: true, value: 5 });
  });

  it('err wraps an error', () => {
    expect(err('bad')).toEqual({ ok: false, error: 'bad' });
  });

  it('narrows on the ok flag', () => {
    const r: Result<number, string> = Math.random() >= 0 ? ok(2) : err('never');
    if (!r.ok) throw new Error('expected ok');
    expect(r.value * 2).toBe(4);
  });
});
