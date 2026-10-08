import { describe, expect, it } from 'vitest';
import { rat, toString } from '../rational';
import { evaluate, MAX_FACTORIAL, type EvalError } from './evaluate';
import { parseExpression, type Node } from './parse';

function run(source: string, n?: number): ReturnType<typeof evaluate> {
  const tree = parseExpression(source, { variables: ['n'] });
  if (!tree.ok) throw new Error(tree.error.message);
  return evaluate(tree.value, n === undefined ? new Map() : new Map([['n', rat(n)]]));
}

function value(source: string, n?: number): string {
  const r = run(source, n);
  if (!r.ok) throw new Error(r.error.message);
  return toString(r.value);
}

function failure(source: string, n?: number): EvalError {
  const r = run(source, n);
  if (r.ok) throw new Error(`expected "${source}" to fail`);
  return r.error;
}

describe('evaluate: combinatorics', () => {
  it('computes binom and C', () => {
    expect(value('binom(5,2)')).toBe('10');
    expect(value('C(10, 3)')).toBe('120');
    expect(value('binom(n, 2)', 5)).toBe('10');
    expect(value('binom(2n, n)', 3)).toBe('20');
    expect(value('binom(n, n+1)', 3)).toBe('0');
    expect(value('binom(-1, 3)')).toBe('-1');
    expect(value('binom(1/2, 2)')).toBe('-1/8');
  });

  it('computes factorials', () => {
    expect(value('0!')).toBe('1');
    expect(value('5!')).toBe('120');
    expect(value('(n+1)!', 4)).toBe('120');
    expect(value('(2n)!/(n!(n+1)!)', 3)).toBe('5');
  });

  it('alternates (-1)^n', () => {
    const signs = [0, 1, 2, 3, 4, 5].map((n) => value('(-1)^n', n));
    expect(signs).toEqual(['1', '-1', '1', '-1', '1', '-1']);
    expect(value('(-1)^(n+1) n', 4)).toBe('-4');
  });

  it('is exact with rationals', () => {
    expect(value('1/3 + 1/6')).toBe('1/2');
    expect(value('(2/3)^-2')).toBe('9/4');
    expect(value('n/(n+1) + 1/(n+1)', 7)).toBe('1');
  });
});

describe('evaluate: typed errors', () => {
  it('division by zero is undefined', () => {
    expect(failure('1/0').kind).toBe('undefined');
    expect(failure('1/(n-3)', 3).kind).toBe('undefined');
    expect(failure('0^-1').kind).toBe('undefined');
  });

  it('factorials of negative or fractional numbers are undefined', () => {
    expect(failure('(-1)!').kind).toBe('undefined');
    expect(failure('(1/2)!').kind).toBe('undefined');
  });

  it('a fractional binom bottom is undefined', () => {
    expect(failure('binom(5, 1/2)').kind).toBe('undefined');
  });

  it('fractional exponents are unsupported', () => {
    expect(failure('4^(1/2)').kind).toBe('unsupported');
  });

  it('a missing variable is unbound', () => {
    expect(failure('n + 1')).toEqual({ kind: 'unbound', message: 'No value for n.' });
  });

  it('accepts factorials up to 200', () => {
    expect(MAX_FACTORIAL).toBe(200);
    expect(run('200!').ok).toBe(true);
    expect(failure('201!').kind).toBe('too-large');
  });
});

describe('evaluate: hostile input stays safe and fast', () => {
  it.each([
    '10^4096^4096',
    '2^4097',
    '2^-4097',
    '2^2^2^2^2',
    '9^9^9',
    '200!!',
    '(10^4000)!',
    '9^4096*9^4096*9^4096',
    '1/9^4096 + 1/7^4096 + 1/5^4096',
    'binom(10^9, 4097)',
    'binom(10^4000, 3000)',
    '(10^4096)^3',
  ])('%s is too large', (source) => {
    const start = performance.now();
    expect(failure(source).kind).toBe('too-large');
    expect(performance.now() - start).toBeLessThan(500);
  });

  it('a result with up to 10000 digits is fine', () => {
    const r = run('10^4096 * 10^4096 + 1');
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.num.toString().length).toBe(8193);
  });

  it('a very deep tree gives an error instead of throwing', () => {
    let node: Node = { kind: 'num', value: rat(1) };
    for (let i = 0; i < 200_000; i++) node = { kind: 'neg', arg: node };
    const r = evaluate(node);
    expect(r.ok).toBe(false);
  });
});
