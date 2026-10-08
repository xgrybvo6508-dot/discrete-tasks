import type { Problem } from '../bank/types';
import { validateProblem } from '../bank/validate';
import { canonicalInput, checkAnswer } from '../lib/check';
import { parseFormula } from '../lib/check/expression';
import { parseCanonicalNumber } from '../lib/check/numeric';
import { evaluate } from '../lib/expr/evaluate';
import { isFiniteNumber, isRecord, isString, own } from '../lib/guards';
import { extractMath } from '../lib/markdown';
import { isValidTex } from '../lib/math';
import { equals, rat } from '../lib/rational';
import { err, ok, type Result } from '../lib/result';

export interface SmallCase {
  readonly n: number;
  readonly value: number | string;
}

export interface GeneratedProblem {
  readonly problem: Omit<Problem, 'id' | 'source'>;
  readonly smallCases: readonly SmallCase[];
}

function texErrors(problem: Omit<Problem, 'id' | 'source'>): string[] {
  const fields = [
    problem.statement,
    ...problem.hints,
    problem.solution,
    problem.answer.display,
    ...(problem.answer.keyPoints ?? []),
  ];
  const errors: string[] = [];
  for (const text of fields) {
    for (const span of extractMath(text).math) {
      if (!isValidTex(span.tex, span.display)) errors.push(`Invalid TeX: ${span.tex}`);
    }
  }
  return errors;
}

function compact(text: string): string {
  return text
    .toLowerCase()
    .replace(/[$\\{}\s]/g, '')
    .replace(/[.,;:()[\]]/g, '');
}

function answerNeedles(problem: Pick<Problem, 'answer'>): string[] {
  if (problem.answer.type === 'proof') return [];
  const canonical = problem.answer.canonical;
  const values = Array.isArray(canonical) ? canonical : canonical === undefined ? [] : [canonical];
  return [problem.answer.display, ...values.map(String)].map(compact).filter((x) => x.length > 0);
}

export function hintLeaksAnswer(problem: Pick<Problem, 'answer'>, hint: string): boolean {
  const text = compact(hint);
  return answerNeedles(problem).some((needle) => text.includes(needle));
}

function parseSmallCases(raw: unknown, errors: string[]): SmallCase[] {
  if (!Array.isArray(raw)) {
    errors.push('smallCases must contain exactly four values for an expression answer');
    return [];
  }
  const cases: SmallCase[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      errors.push('Each small case must be an object');
      continue;
    }
    const n = own(item, 'n');
    const value = own(item, 'value');
    if (!Number.isSafeInteger(n) || (!isFiniteNumber(value) && !isString(value))) {
      errors.push('Each small case needs an integer n and a numeric value');
      continue;
    }
    cases.push({ n: n as number, value });
  }
  if (cases.length !== 4 || new Set(cases.map((c) => c.n)).size !== 4) {
    errors.push('smallCases must contain exactly four distinct n values');
  }
  return cases;
}

function crossCheckExpression(
  problem: Omit<Problem, 'id' | 'source'>,
  cases: readonly SmallCase[],
  errors: string[],
): void {
  const canonical = problem.answer.canonical;
  if (typeof canonical !== 'string') return;
  const formula = parseFormula(canonical);
  if (!formula.ok) {
    errors.push('The canonical expression could not be parsed');
    return;
  }
  for (const item of cases) {
    const actual = evaluate(formula.value, new Map([['n', rat(item.n)]]));
    const expected = parseCanonicalNumber(item.value);
    if (!actual.ok || !expected || !equals(actual.value, expected)) {
      errors.push(`smallCases does not match the canonical expression at n = ${item.n}`);
    }
  }
}

export function validateGeneratedProblem(raw: unknown): Result<GeneratedProblem, string[]> {
  if (!isRecord(raw)) return err(['Generated problem must be an object']);
  const validated = validateProblem({ ...raw, id: 'ai-generated-validation', source: 'ai' });
  if (!validated.ok) return validated;
  const { id, source, ...problem } = validated.value;
  void id;
  void source;
  const errors = texErrors(problem);

  const canonical = canonicalInput(problem.answer);
  if (problem.answer.type !== 'proof') {
    if (canonical === null || checkAnswer(problem.answer, canonical).status !== 'correct') {
      errors.push('The canonical answer could not be checked');
    }
    problem.hints.forEach((hint, index) => {
      if (hintLeaksAnswer(problem, hint)) errors.push(`Hint ${index + 1} reveals the answer`);
    });
  }

  let smallCases: SmallCase[] = [];
  const rawCases = own(raw, 'smallCases');
  if (problem.answer.type === 'expression') {
    smallCases = parseSmallCases(rawCases, errors);
    crossCheckExpression(problem, smallCases, errors);
  } else if (rawCases !== undefined) {
    errors.push('smallCases is only for expression answers');
  }

  return errors.length > 0 ? err(errors) : ok({ problem, smallCases });
}
