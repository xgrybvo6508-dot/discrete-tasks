import { describe, expect, it } from 'vitest';
import {
  add,
  binomial,
  checkSize,
  compare,
  div,
  equals,
  factorial,
  fromNumber,
  isInteger,
  isZero,
  MathError,
  mul,
  neg,
  ONE,
  parseRational,
  pow,
  rat,
  sub,
  toNumber,
  toString,
  ZERO,
  type MathErrorKind,
  type Rational,
} from './rational';

const str = (r: Rational | null): string | null => (r ? toString(r) : null);

function kindOf(f: () => unknown): MathErrorKind | 'none' | 'other' {
  try {
    f();
    return 'none';
  } catch (e) {
    return e instanceof MathError ? e.kind : 'other';
  }
}

const digits = (r: Rational): number => (r.num < 0n ? -r.num : r.num).toString().length;

describe('rat', () => {
  it('normalises sign and common factors', () => {
    expect(rat(6, -4)).toEqual({ num: -3n, den: 2n });
    expect(rat(-6, -4)).toEqual({ num: 3n, den: 2n });
    expect(rat(0, -5)).toEqual({ num: 0n, den: 1n });
    expect(rat(10n, 5n)).toEqual({ num: 2n, den: 1n });
  });

  it('rejects a zero denominator with kind undefined', () => {
    expect(kindOf(() => rat(1, 0))).toBe('undefined');
  });

  it('exports ZERO and ONE', () => {
    expect(str(ZERO)).toBe('0');
    expect(str(ONE)).toBe('1');
  });
});

describe('parseRational', () => {
  it.each([
    ['42', '42'],
    ['-7', '-7'],
    ['+5', '5'],
    ['  12 ', '12'],
    ['007', '7'],
    ['0', '0'],
  ])('reads the integer %j', (input, expected) => {
    expect(str(parseRational(input))).toBe(expected);
  });

  it.each([
    ['3/8', '3/8'],
    ['6/16', '3/8'],
    ['3 / -8', '-3/8'],
    ['-3/-8', '3/8'],
    ['4/2', '2'],
    ['0/7', '0'],
  ])('reads the fraction %j', (input, expected) => {
    expect(str(parseRational(input))).toBe(expected);
  });

  it.each([
    ['0.375', '3/8'],
    ['.5', '1/2'],
    ['5.', '5'],
    ['-0.25', '-1/4'],
    ['+1.50', '3/2'],
    ['-.5', '-1/2'],
    ['10.0', '10'],
  ])('reads the decimal %j', (input, expected) => {
    expect(str(parseRational(input))).toBe(expected);
  });

  it.each([
    ['1.5e-3', '3/2000'],
    ['2E3', '2000'],
    ['1e+21', '1000000000000000000000'],
    ['-2.5e1', '-25'],
    ['.5e1', '5'],
  ])('reads the stored scientific value %j', (input, expected) => {
    expect(str(parseRational(input))).toBe(expected);
  });

  it.each([
    '',
    '   ',
    'abc',
    '1/0',
    '1/2/3',
    '1.2.3',
    '.',
    '0x10',
    'Infinity',
    'NaN',
    '1e',
    '--1',
    '1 2',
    '1.5/2',
    '1e401',
  ])('returns null for %j', (input) => {
    expect(parseRational(input)).toBeNull();
  });

  it('returns null for very long input', () => {
    expect(parseRational('1'.repeat(10_011))).toBeNull();
  });
});

describe('fromNumber', () => {
  it.each([
    [42, '42'],
    [0.375, '3/8'],
    [0.1, '1/10'],
    [-0, '0'],
    [1e21, '1000000000000000000000'],
    [1.5e-7, '3/20000000'],
    [2 ** 53 - 1, '9007199254740991'],
    [2 ** 60, '1152921504606847000'],
  ])('converts %d as its shortest decimal form', (input, expected) => {
    expect(str(fromNumber(input))).toBe(expected);
  });

  it.each([NaN, Infinity, -Infinity])('returns null for %d', (input) => {
    expect(fromNumber(input)).toBeNull();
  });
});

describe('arithmetic', () => {
  const half = rat(1, 2);
  const third = rat(1, 3);

  it('adds, subtracts, multiplies and divides exactly', () => {
    expect(str(add(half, third))).toBe('5/6');
    expect(str(sub(half, third))).toBe('1/6');
    expect(str(mul(rat(2, 3), rat(3, 4)))).toBe('1/2');
    expect(str(div(half, third))).toBe('3/2');
    expect(str(add(add(third, third), third))).toBe('1');
    expect(str(neg(half))).toBe('-1/2');
  });

  it('division by zero has kind undefined', () => {
    expect(kindOf(() => div(ONE, ZERO))).toBe('undefined');
  });

  it('compares and tests equality', () => {
    expect(compare(half, third)).toBe(1);
    expect(compare(third, half)).toBe(-1);
    expect(compare(rat(2, 4), half)).toBe(0);
    expect(compare(rat(-1, 2), rat(-1, 3))).toBe(-1);
    expect(equals(rat(3, 8), rat(6, 16))).toBe(true);
    expect(equals(rat(3, 8), rat(3, 7))).toBe(false);
  });

  it('has predicates and conversions', () => {
    expect(isInteger(rat(4, 2))).toBe(true);
    expect(isInteger(half)).toBe(false);
    expect(isZero(rat(0, 3))).toBe(true);
    expect(toNumber(rat(3, 8))).toBe(0.375);
    expect(toString(rat(-3, 8))).toBe('-3/8');
  });
});

describe('pow', () => {
  it('raises to whole exponents', () => {
    expect(str(pow(rat(2), rat(10)))).toBe('1024');
    expect(str(pow(rat(-2), rat(3)))).toBe('-8');
    expect(str(pow(rat(2, 3), rat(2)))).toBe('4/9');
  });

  it('gives reciprocals for negative exponents', () => {
    expect(str(pow(rat(2), rat(-3)))).toBe('1/8');
    expect(str(pow(rat(2, 3), rat(-2)))).toBe('9/4');
    expect(str(pow(rat(-2), rat(-3)))).toBe('-1/8');
    expect(str(pow(rat(-1, 2), rat(-1)))).toBe('-2');
  });

  it('treats zero as in combinatorics', () => {
    expect(str(pow(ZERO, ZERO))).toBe('1');
    expect(str(pow(ZERO, rat(5)))).toBe('0');
    expect(kindOf(() => pow(ZERO, rat(-1)))).toBe('undefined');
  });

  it('accepts an exponent written as a whole fraction', () => {
    expect(str(pow(rat(3), rat(4, 2)))).toBe('9');
  });

  it('rejects non-integer exponents as unsupported', () => {
    expect(kindOf(() => pow(rat(4), rat(1, 2)))).toBe('unsupported');
  });

  it('limits |exponent| to 4096', () => {
    expect(digits(pow(rat(2), rat(4096)))).toBe(1234);
    expect(str(pow(rat(-1), rat(4096)))).toBe('1');
    expect(str(pow(rat(1), rat(-4096)))).toBe('1');
    expect(kindOf(() => pow(rat(2), rat(4097)))).toBe('too-large');
    expect(kindOf(() => pow(rat(1), rat(-4097)))).toBe('too-large');
  });

  it('enforces the digit limit on the result', () => {
    expect(digits(pow(rat(10), rat(4096)))).toBe(4097);
    expect(kindOf(() => pow(rat(10n ** 3000n), rat(4)))).toBe('too-large');
    expect(kindOf(() => pow(rat(1n, 10n ** 3000n), rat(-4)))).toBe('too-large');
  });

  it('rejects huge powers quickly, before computing them', () => {
    const start = performance.now();
    expect(kindOf(() => pow(rat(10n ** 9000n), rat(4096)))).toBe('too-large');
    expect(performance.now() - start).toBeLessThan(200);
  });
});

describe('checkSize', () => {
  it('allows exactly 10000 digits and rejects 10001', () => {
    const max = 10n ** 10_000n - 1n;
    expect(checkSize(rat(max))).toEqual(rat(max));
    expect(checkSize(rat(1n, max))).toEqual(rat(1n, max));
    expect(kindOf(() => checkSize(rat(10n ** 10_000n)))).toBe('too-large');
    expect(kindOf(() => checkSize(rat(-(10n ** 10_000n))))).toBe('too-large');
    expect(kindOf(() => checkSize(rat(1n, 10n ** 10_000n)))).toBe('too-large');
  });
});

describe('factorial', () => {
  it('computes whole factorials', () => {
    expect(str(factorial(ZERO, 200))).toBe('1');
    expect(str(factorial(rat(1), 200))).toBe('1');
    expect(str(factorial(rat(5), 200))).toBe('120');
    expect(str(factorial(rat(10, 2), 200))).toBe('120');
    expect(digits(factorial(rat(200), 200))).toBe(375);
  });

  it('rejects arguments above the maximum', () => {
    expect(kindOf(() => factorial(rat(201), 200))).toBe('too-large');
  });

  it('rejects negative and non-integer arguments as undefined', () => {
    expect(kindOf(() => factorial(rat(-1), 200))).toBe('undefined');
    expect(kindOf(() => factorial(rat(1, 2), 200))).toBe('undefined');
  });
});

describe('binomial', () => {
  const b = (a: Rational, k: number): string => toString(binomial(a, rat(k), 4096));

  it('computes ordinary binomial coefficients', () => {
    expect(b(rat(5), 2)).toBe('10');
    expect(b(rat(5), 0)).toBe('1');
    expect(b(rat(5), 5)).toBe('1');
    expect(b(rat(0), 0)).toBe('1');
    expect(b(rat(100), 50)).toBe('100891344545564193334812497256');
  });

  it('is 0 for k < 0, and for k > a when a is a non-negative integer', () => {
    expect(b(rat(5), 6)).toBe('0');
    expect(b(rat(5), -1)).toBe('0');
    expect(b(rat(-3), -2)).toBe('0');
    expect(b(rat(5), 10_000)).toBe('0');
  });

  it('is generalised to negative and fractional tops', () => {
    expect(b(rat(-1), 3)).toBe('-1');
    expect(b(rat(-2), 2)).toBe('3');
    expect(b(rat(1, 2), 2)).toBe('-1/8');
    expect(b(rat(1, 2), 3)).toBe('1/16');
  });

  it('needs a whole bottom', () => {
    expect(kindOf(() => binomial(rat(5), rat(1, 2), 4096))).toBe('undefined');
  });

  it('computes large coefficients whose result is within the digit limit', () => {
    const r = binomial(rat(8192), rat(4096), 4096);
    let top = 1n;
    for (let i = 4097n; i <= 8192n; i++) top *= i;
    let bottom = 1n;
    for (let i = 2n; i <= 4096n; i++) bottom *= i;
    expect(r).toEqual(rat(top / bottom));
    expect(digits(r)).toBe(2464);
  });

  it('rejects k above maxK and results above the digit limit', () => {
    expect(kindOf(() => binomial(rat(10_000), rat(5000), 4096))).toBe('too-large');
    expect(kindOf(() => binomial(rat(10n ** 20n), rat(4096), 4096))).toBe('too-large');
  });
});
