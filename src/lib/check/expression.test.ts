import { describe, expect, it } from 'vitest';
import { checkExpression, mismatchMessage, samplePoints } from './expression';
import { MESSAGES } from './types';

const CORRECT = { status: 'correct', message: 'Correct.' };

describe('checkExpression: equivalent forms', () => {
  it.each(['2(2^n-1)', '2*2^n - 2', '2^(n+1) - 2', '2^n + 2^n - 2', '2**(n+1)-2', '-2 + 2^(n+1)'])(
    '%j equals 2^(n+1)-2',
    (input) => {
      expect(checkExpression(input, '2^(n+1)-2')).toEqual(CORRECT);
    },
  );

  const catalan = ['binom(2n,n)/(n+1)', '(2n)!/(n!(n+1)!)', 'binom(2n,n) - binom(2n,n+1)'];
  it.each(catalan.flatMap((a) => catalan.map((b) => [a, b] as const)))(
    'Catalan form %j equals %j',
    (input, canonical) => {
      expect(checkExpression(input, canonical)).toEqual(CORRECT);
    },
  );

  it.each([
    ['n(n+1)/2', 'binom(n+1, 2)'],
    ['0.5n(n+1)', 'n(n+1)/2'],
    ['(n+1)(n+2)', 'n^2 + 3n + 2'],
    ['(-1)^(n+2)', '(-1)^n'],
    ['C(n, 2)', 'binom(n,2)'],
    ['[n+1]{n-1}', 'n^2 - 1'],
  ])('%j equals %j', (input, canonical) => {
    expect(checkExpression(input, canonical).status).toBe('correct');
  });

  it.each(['a_n = 2^n - 1', 'f(n) = 2^n - 1', 'T(n)=2^n-1', 'a_n=2^n-1'])(
    'strips the left side in %j',
    (input) => {
      expect(checkExpression(input, '2^n - 1')).toEqual(CORRECT);
    },
  );
});

describe('checkExpression: wrong forms', () => {
  it('reports a mismatch at the first n', () => {
    expect(checkExpression('2^n', '2^n - 1')).toEqual({
      status: 'incorrect',
      message: 'Not quite. Want a hint?',
      detail: 'Your formula does not match at n = 1.',
    });
  });

  it('reports the first mismatching n after a matching run', () => {
    expect(checkExpression('n^2', 'n^2 + (n-1)(n-2)(n-3)').detail).toBe(
      'Your formula matches for n = 1..3 but not for n = 4.',
    );
    expect(checkExpression('(-1)^(n+1)', '(-1)^n').detail).toBe(
      'Your formula does not match at n = 1.',
    );
  });

  it('lists matched points one by one when some were skipped', () => {
    const canonical = 'n(n-3)/(n-3)';
    expect(checkExpression('n + (n-1)(n-2)(n-3)(n-4)', canonical).detail).toBe(
      'Your formula matches for n = 1, 2, 4 but not for n = 5.',
    );
  });

  it('reports a mismatch at an extra point beyond the range', () => {
    expect(
      checkExpression('n', 'n + (n-1)(n-2)(n-3)(n-4)(n-5)(n-6)(n-7)(n-8)(n-9)(n-10)').detail,
    ).toBe('Your formula matches for n = 1..10 but not for n = 12.');
  });

  it('never reveals the expected value', () => {
    const r = checkExpression('2^n', '2^n + 1000');
    expect(r.status).toBe('incorrect');
    expect(r.detail).not.toContain('1002');
    expect(r.detail).not.toContain('1000');
  });
});

describe('checkExpression: undefined points', () => {
  it('skips points where a side is undefined', () => {
    expect(checkExpression('1/(n-3)', '1/(n-3)')).toEqual(CORRECT);
    expect(checkExpression('(n-3)/(n-3)', '1')).toEqual(CORRECT);
    expect(checkExpression('1', '(n-3)/(n-3)')).toEqual(CORRECT);
  });

  it('needs at least 6 valid points', () => {
    const f = '1/((n-1)(n-2)(n-3)(n-4)(n-5)(n-6)(n-7))';
    expect(checkExpression(f, f)).toEqual({
      status: 'unparsed',
      message: 'I could only check this formula at a few values of n. Try another way to write it.',
      detail: 'Division by zero.',
    });
    const g = '1/((n-1)(n-2)(n-3)(n-4)(n-5)(n-6))';
    expect(checkExpression(g, g)).toEqual(CORRECT);
  });

  it('treats too-large values as undefined points', () => {
    const r = checkExpression('(n+200)!', 'n');
    expect(r.status).toBe('unparsed');
    expect(r.message).toBe(MESSAGES.fewPoints);
    expect(r.detail).toBe('Factorials above 200! are not supported.');
  });
});

describe('checkExpression: input problems', () => {
  it('empty input asks for an answer', () => {
    expect(checkExpression('  ', 'n')).toEqual({ status: 'unparsed', message: MESSAGES.empty });
  });

  it('unreadable input gives the formula message with a reason', () => {
    expect(checkExpression('x + 1', 'n + 1')).toEqual({
      status: 'unparsed',
      message: 'I could not read this as a formula in n. Try a form like 2^n - 1 or binom(n, 2).',
      detail: 'The name "x" is not known. Use n.',
    });
    expect(checkExpression('2^n +', 'n').message).toBe(MESSAGES.formula);
    expect(checkExpression('a = b = c', 'n').message).toBe(MESSAGES.formula);
  });

  it('an unreadable canonical answer is reported', () => {
    expect(checkExpression('n', 'x^2')).toEqual({ status: 'unparsed', message: MESSAGES.stored });
  });

  it('accepts extra literal inputs', () => {
    expect(
      checkExpression('The Catalan Numbers', '2^n', { accepted: ['the catalan numbers'] }).status,
    ).toBe('correct');
  });

  it('uses nRange for the sample points', () => {
    expect(checkExpression('n', 'n*(n+1)/(n+1)', { nRange: [0, 5] }).status).toBe('correct');
    expect(checkExpression('n^0', '1', { nRange: [0, 5] }).status).toBe('correct');
    expect(checkExpression('n', 'n + n(n-1)', { nRange: [0, 5] }).detail).toBe(
      'Your formula matches for n = 0..1 but not for n = 2.',
    );
  });
});

describe('samplePoints', () => {
  it('uses [1, 10] plus 12 and 15 by default', () => {
    expect(samplePoints()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15]);
  });

  it('adds 12 and 15 to a custom range, without duplicates', () => {
    expect(samplePoints([0, 3])).toEqual([0, 1, 2, 3, 12, 15]);
    expect(samplePoints([10, 16])).toEqual([10, 11, 12, 13, 14, 15, 16]);
  });

  it('leaves out extra points below the range', () => {
    expect(samplePoints([13, 16])).toEqual([13, 14, 15, 16]);
  });

  it('caps a wide range at 40 points', () => {
    const points = samplePoints([1, 1_000_000]);
    expect(points).toHaveLength(40);
    expect(points.at(-1)).toBe(40);
  });

  it('uses only whole numbers when the range has fractions', () => {
    expect(samplePoints([0.5, 3.5])).toEqual([1, 2, 3, 12, 15]);
  });
});

describe('mismatchMessage', () => {
  it('describes single, contiguous and scattered matches', () => {
    expect(mismatchMessage([], 1)).toBe('Your formula does not match at n = 1.');
    expect(mismatchMessage([1], 2)).toBe('Your formula matches for n = 1 but not for n = 2.');
    expect(mismatchMessage([1, 2, 3], 4)).toBe(
      'Your formula matches for n = 1..3 but not for n = 4.',
    );
    expect(mismatchMessage([1, 3], 4)).toBe('Your formula matches for n = 1, 3 but not for n = 4.');
  });
});
