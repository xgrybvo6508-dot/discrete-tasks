import { evaluate } from '../expr/evaluate';
import { parseExpression } from '../expr/parse';
import { equals, fromNumber, parseRational, toNumber, type Rational } from '../rational';
import { err, ok, type Result } from '../result';
import { correct, incorrect, matchesAccepted, MESSAGES, unparsed, type CheckResult } from './types';

export interface NumericOptions {
  readonly tolerance?: number | undefined;
  readonly accepted?: readonly string[] | undefined;
}

const GROUPED = /^[+-]?\d{1,3}([, ]\d{3})+$/;

/** Reads a plain number or a constant expression such as `2^10` or `binom(10, 3)`. */
export function parseNumber(text: string): Result<Rational, string> {
  let s = text.trim();
  if (GROUPED.test(s)) s = s.replace(/[, ]/g, '');
  const tree = parseExpression(s, { variables: [] });
  if (!tree.ok) return err(tree.error.message);
  const value = evaluate(tree.value);
  return value.ok ? ok(value.value) : err(value.error.message);
}

/** Canonical numeric answers are integers, rational strings like "3/8", or expressions. */
export function parseCanonicalNumber(canonical: number | string): Rational | null {
  if (typeof canonical === 'number') return fromNumber(canonical);
  const direct = parseRational(canonical);
  if (direct) return direct;
  const parsed = parseNumber(canonical);
  return parsed.ok ? parsed.value : null;
}

export function checkNumeric(
  input: string,
  canonical: number | string,
  options: NumericOptions = {},
): CheckResult {
  if (input.trim().length === 0) return unparsed(MESSAGES.empty);
  if (matchesAccepted(input, options.accepted)) return correct();
  const expected = parseCanonicalNumber(canonical);
  if (!expected) return unparsed(MESSAGES.stored);
  const given = parseNumber(input);
  if (!given.ok) return unparsed(MESSAGES.number, given.error);
  const { tolerance } = options;
  if (tolerance !== undefined && Number.isFinite(tolerance) && tolerance > 0) {
    const diff = Math.abs(toNumber(given.value) - toNumber(expected));
    return diff <= tolerance ? correct() : incorrect();
  }
  return equals(given.value, expected) ? correct() : incorrect();
}
