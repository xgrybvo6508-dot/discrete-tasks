/** An exact rational number. Always normalised: gcd(num, den) = 1 and den > 0. */
export interface Rational {
  readonly num: bigint;
  readonly den: bigint;
}

export type MathErrorKind = 'undefined' | 'too-large' | 'unsupported';

export class MathError extends Error {
  override readonly name = 'MathError';
  constructor(
    readonly kind: MathErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export const MAX_EXPONENT = 4096;
export const MAX_DIGITS = 10_000;
/** A number with more bits than this has more than MAX_DIGITS decimal digits. */
const MAX_BITS = Math.ceil(MAX_DIGITS * Math.log2(10));
/** The smallest number with more than MAX_DIGITS digits. */
const DIGIT_LIMIT = 10n ** BigInt(MAX_DIGITS);

const abs = (x: bigint): bigint => (x < 0n ? -x : x);

function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function bitLength(x: bigint): number {
  return x === 0n ? 0 : abs(x).toString(2).length;
}

export function rat(num: bigint | number, den: bigint | number = 1n): Rational {
  let n = BigInt(num);
  let d = BigInt(den);
  if (d === 0n) throw new MathError('undefined', 'Division by zero.');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return g > 1n ? { num: n / g, den: d / g } : { num: n, den: d };
}

export const ZERO = rat(0);
export const ONE = rat(1);

/** Throws if either part of `r` has more than MAX_DIGITS digits. */
export function checkSize(r: Rational): Rational {
  const tooLong = (x: bigint): boolean => {
    const bits = bitLength(x);
    return bits > MAX_BITS || (bits === MAX_BITS && abs(x) >= DIGIT_LIMIT);
  };
  if (tooLong(r.num) || tooLong(r.den)) {
    throw new MathError('too-large', `The number has more than ${MAX_DIGITS} digits.`);
  }
  return r;
}

export const add = (a: Rational, b: Rational): Rational =>
  rat(a.num * b.den + b.num * a.den, a.den * b.den);
export const sub = (a: Rational, b: Rational): Rational =>
  rat(a.num * b.den - b.num * a.den, a.den * b.den);
export const mul = (a: Rational, b: Rational): Rational => rat(a.num * b.num, a.den * b.den);
export const neg = (a: Rational): Rational => ({ num: -a.num, den: a.den });

export function div(a: Rational, b: Rational): Rational {
  if (b.num === 0n) throw new MathError('undefined', 'Division by zero.');
  return rat(a.num * b.den, a.den * b.num);
}

export const isInteger = (a: Rational): boolean => a.den === 1n;
export const isZero = (a: Rational): boolean => a.num === 0n;
export const equals = (a: Rational, b: Rational): boolean => a.num === b.num && a.den === b.den;

export function compare(a: Rational, b: Rational): -1 | 0 | 1 {
  const l = a.num * b.den;
  const r = b.num * a.den;
  return l < r ? -1 : l > r ? 1 : 0;
}

/** Integer powers only. 0^0 = 1, as in combinatorics. */
export function pow(base: Rational, exponent: Rational): Rational {
  if (!isInteger(exponent)) {
    throw new MathError('unsupported', 'Only whole-number exponents are supported.');
  }
  const e = exponent.num;
  if (abs(e) > BigInt(MAX_EXPONENT)) {
    throw new MathError('too-large', `Exponents larger than ${MAX_EXPONENT} are not supported.`);
  }
  if (e === 0n) return ONE;
  if (base.num === 0n) {
    if (e < 0n) throw new MathError('undefined', 'Division by zero.');
    return ZERO;
  }
  const k = Number(abs(e));
  const isUnit = (x: bigint): boolean => abs(x) === 1n;
  if (
    (!isUnit(base.num) && bitLength(base.num) * k > MAX_BITS + k) ||
    (!isUnit(base.den) && bitLength(base.den) * k > MAX_BITS + k)
  ) {
    throw new MathError('too-large', `The number has more than ${MAX_DIGITS} digits.`);
  }
  const raised = checkSize({ num: base.num ** BigInt(k), den: base.den ** BigInt(k) });
  return e < 0n ? div(ONE, raised) : raised;
}

const INT = /^[+-]?\d+$/;
const FRACTION = /^([+-]?\d+)\s*\/\s*([+-]?\d+)$/;
const DECIMAL = /^([+-]?)(\d*)\.(\d+)$|^([+-]?)(\d+)\.$/;
const SCIENTIFIC = /^([+-]?\d*\.?\d+)e([+-]?\d+)$/i;

/** Parses an integer, `a/b`, a finite decimal or (for stored values) `1.5e-3`. */
export function parseRational(text: string): Rational | null {
  const s = text.trim();
  if (s.length === 0 || s.length > MAX_DIGITS + 10) return null;
  if (INT.test(s)) return rat(BigInt(s));
  const f = FRACTION.exec(s);
  if (f?.[1] !== undefined && f[2] !== undefined) {
    const den = BigInt(f[2]);
    return den === 0n ? null : rat(BigInt(f[1]), den);
  }
  const d = DECIMAL.exec(s);
  if (d) {
    const sign = d[1] ?? d[4] ?? '';
    const whole = d[2] ?? d[5] ?? '';
    const frac = d[3] ?? '';
    const digits = `${whole || '0'}${frac}`;
    return rat(BigInt(`${sign}${digits}`), 10n ** BigInt(frac.length));
  }
  const e = SCIENTIFIC.exec(s);
  if (e?.[1] !== undefined && e[2] !== undefined) {
    const mantissa = parseRational(e[1]);
    const exp = Number(e[2]);
    if (!mantissa || Math.abs(exp) > 400) return null;
    return mul(mantissa, pow(rat(10), rat(exp)));
  }
  return null;
}

/** Converts a finite JS number exactly as written in its shortest decimal form. */
export function fromNumber(x: number): Rational | null {
  if (!Number.isFinite(x)) return null;
  if (Number.isSafeInteger(x)) return rat(x);
  return parseRational(String(x));
}

export function toNumber(a: Rational): number {
  return Number(a.num) / Number(a.den);
}

export function toString(a: Rational): string {
  return a.den === 1n ? a.num.toString() : `${a.num.toString()}/${a.den.toString()}`;
}

export function factorial(n: Rational, max: number): Rational {
  if (!isInteger(n) || n.num < 0n) {
    throw new MathError('undefined', 'Factorial needs a whole number that is 0 or more.');
  }
  if (n.num > BigInt(max)) {
    throw new MathError('too-large', `Factorials above ${max}! are not supported.`);
  }
  let acc = 1n;
  for (let i = 2n; i <= n.num; i++) acc *= i;
  return rat(acc);
}

/** Generalised binomial: binom(a, k) = a(a-1)...(a-k+1)/k! for whole k >= 0, else 0. */
export function binomial(a: Rational, k: Rational, maxK: number): Rational {
  if (!isInteger(k)) throw new MathError('undefined', 'binom(a, b) needs a whole number b.');
  if (k.num < 0n) return ZERO;
  let kk = k.num;
  if (isInteger(a) && a.num >= 0n) {
    if (kk > a.num) return ZERO;
    if (kk > a.num - kk) kk = a.num - kk;
  }
  if (kk > BigInt(maxK)) {
    throw new MathError('too-large', 'This binomial coefficient is too large to compute.');
  }
  // After step i, acc = binom(a, i + 1), so the size check sees binomials, not a raw falling factorial.
  let acc = ONE;
  for (let i = 0n; i < kk; i++) {
    acc = checkSize(div(mul(acc, sub(a, rat(i))), rat(i + 1n)));
  }
  return acc;
}
