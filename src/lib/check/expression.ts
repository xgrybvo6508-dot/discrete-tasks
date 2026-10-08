import { evaluate } from '../expr/evaluate';
import { parseExpression, type Node } from '../expr/parse';
import { equals, rat } from '../rational';
import { correct, incorrect, matchesAccepted, MESSAGES, unparsed, type CheckResult } from './types';

export interface ExpressionOptions {
  readonly nRange?: readonly [number, number] | undefined;
  readonly accepted?: readonly string[] | undefined;
}

export const DEFAULT_N_RANGE: readonly [number, number] = [1, 10];
export const EXTRA_POINTS: readonly number[] = [12, 15];
export const MIN_VALID_POINTS = 6;
const MAX_RANGE_POINTS = 40;

export function samplePoints(nRange: readonly [number, number] = DEFAULT_N_RANGE): number[] {
  const lo = Math.ceil(nRange[0]);
  const hi = Math.floor(nRange[1]);
  const points = new Set<number>();
  for (let i = 0; i < MAX_RANGE_POINTS && lo + i <= hi; i++) points.add(lo + i);
  for (const n of EXTRA_POINTS) if (n >= lo) points.add(n);
  return [...points].filter((n) => Number.isSafeInteger(n)).sort((a, b) => a - b);
}

/** "f(n) = 2^n" and "a_n = 2^n" are read as "2^n". */
function stripLeftSide(input: string): string {
  const parts = input.split('=');
  return parts.length === 2 ? (parts[1] ?? '') : input;
}

export function parseFormula(text: string): ReturnType<typeof parseExpression> {
  return parseExpression(stripLeftSide(text).trim(), { variables: ['n'] });
}

function describePoints(ns: readonly number[]): string {
  const first = ns[0];
  const last = ns.at(-1);
  if (first === undefined || last === undefined) return '';
  if (ns.length === 1) return `n = ${first}`;
  const contiguous = last - first === ns.length - 1;
  return contiguous ? `n = ${first}..${last}` : `n = ${ns.join(', ')}`;
}

export function mismatchMessage(matched: readonly number[], failedAt: number): string {
  if (matched.length === 0) return `Your formula does not match at n = ${failedAt}.`;
  return `Your formula matches for ${describePoints(matched)} but not for n = ${failedAt}.`;
}

export function compareFormulas(
  given: Node,
  expected: Node,
  points: readonly number[],
): CheckResult {
  const matched: number[] = [];
  let firstError: string | undefined;
  for (const n of points) {
    const env = new Map([['n', rat(n)]]);
    const a = evaluate(given, env);
    const b = evaluate(expected, env);
    if (!a.ok) firstError ??= a.error.message;
    if (!a.ok || !b.ok) continue;
    if (!equals(a.value, b.value)) return incorrect(mismatchMessage(matched, n));
    matched.push(n);
  }
  if (matched.length < MIN_VALID_POINTS) return unparsed(MESSAGES.fewPoints, firstError);
  return correct();
}

export function checkExpression(
  input: string,
  canonical: string,
  options: ExpressionOptions = {},
): CheckResult {
  if (input.trim().length === 0) return unparsed(MESSAGES.empty);
  if (matchesAccepted(input, options.accepted)) return correct();
  const expected = parseFormula(canonical);
  if (!expected.ok) return unparsed(MESSAGES.stored);
  const given = parseFormula(input);
  if (!given.ok) return unparsed(MESSAGES.formula, given.error.message);
  return compareFormulas(given.value, expected.value, samplePoints(options.nRange));
}
