import {
  isFiniteNumber,
  isNonEmptyString,
  isOneOf,
  isRecord,
  isString,
  isStringArray,
  own,
  type UnknownRecord,
} from '../lib/guards';
import { err, ok, type Result } from '../lib/result';
import { isTopic } from './topics';
import type { Answer, AnswerType, Difficulty, Problem } from './types';

const isAnswerType = isOneOf<AnswerType>(['numeric', 'expression', 'set', 'proof']);
const isDifficulty = isOneOf<Difficulty>([3, 4, 5]);
const isSource = isOneOf<Problem['source']>(['bank', 'ai']);
const isItem = (v: unknown): v is number | string => isFiniteNumber(v) || isString(v);

function validateAnswer(raw: unknown, errors: string[]): Answer | null {
  if (!isRecord(raw)) {
    errors.push('answer must be an object');
    return null;
  }
  const get = (k: string): unknown => own(raw, k);
  const type = get('type');
  if (!isAnswerType(type)) {
    errors.push('answer.type must be numeric, expression, set or proof');
    return null;
  }
  const display = get('display');
  if (!isNonEmptyString(display)) errors.push('answer.display must be a non-empty string');
  const answer: Answer = { type, display: isString(display) ? display : '' };

  const canonical = get('canonical');
  if (type === 'numeric') {
    if (isFiniteNumber(canonical) || isNonEmptyString(canonical)) answer.canonical = canonical;
    else errors.push('answer.canonical must be a number or a string for numeric answers');
  } else if (type === 'expression') {
    if (isNonEmptyString(canonical)) answer.canonical = canonical;
    else errors.push('answer.canonical must be a string for expression answers');
  } else if (type === 'set') {
    if (Array.isArray(canonical) && canonical.every(isItem)) answer.canonical = [...canonical];
    else errors.push('answer.canonical must be an array of numbers or strings for set answers');
  } else if (canonical !== undefined) {
    errors.push('answer.canonical must be left out for proofs');
  }

  const accepted = get('accepted');
  if (accepted !== undefined) {
    if (isStringArray(accepted)) answer.accepted = [...accepted];
    else errors.push('answer.accepted must be an array of strings');
  }
  const tolerance = get('tolerance');
  if (tolerance !== undefined) {
    if (type === 'numeric' && isFiniteNumber(tolerance) && tolerance > 0)
      answer.tolerance = tolerance;
    else errors.push('answer.tolerance must be a positive number and is for numeric answers only');
  }
  const nRange = get('nRange');
  if (nRange !== undefined) {
    const [lo, hi] = Array.isArray(nRange) ? (nRange as unknown[]) : [];
    const valid =
      type === 'expression' &&
      Array.isArray(nRange) &&
      nRange.length === 2 &&
      Number.isSafeInteger(lo) &&
      Number.isSafeInteger(hi) &&
      (lo as number) <= (hi as number);
    if (valid) answer.nRange = [lo as number, hi as number];
    else
      errors.push(
        'answer.nRange must be [lo, hi] with whole numbers lo <= hi, for expressions only',
      );
  }
  const keyPoints = get('keyPoints');
  if (type === 'proof') {
    if (isStringArray(keyPoints) && keyPoints.length > 0 && keyPoints.every(isNonEmptyString)) {
      answer.keyPoints = [...keyPoints];
    } else {
      errors.push('answer.keyPoints must be a non-empty array of strings for proofs');
    }
  } else if (keyPoints !== undefined) {
    if (isStringArray(keyPoints)) answer.keyPoints = [...keyPoints];
    else errors.push('answer.keyPoints must be an array of strings');
  }
  return answer;
}

function requireText(raw: UnknownRecord, key: string, errors: string[]): string {
  const v = own(raw, key);
  if (!isNonEmptyString(v)) errors.push(`${key} must be a non-empty string`);
  return isString(v) ? v : '';
}

/** Validates an unknown value as a Problem and returns a clean copy without unknown fields. */
export function validateProblem(raw: unknown): Result<Problem, string[]> {
  if (!isRecord(raw)) return err(['problem must be an object']);
  const errors: string[] = [];
  const id = requireText(raw, 'id', errors);
  const source = own(raw, 'source');
  if (!isSource(source)) errors.push('source must be bank or ai');
  const topic = own(raw, 'topic');
  if (!isTopic(topic)) errors.push('topic is not a known topic');
  const difficulty = own(raw, 'difficulty');
  if (!isDifficulty(difficulty)) errors.push('difficulty must be 3, 4 or 5');
  const title = requireText(raw, 'title', errors);
  const statement = requireText(raw, 'statement', errors);
  const solution = requireText(raw, 'solution', errors);
  const hints = own(raw, 'hints');
  const hintsOk =
    Array.isArray(hints) &&
    (hints.length === 3 || hints.length === 4) &&
    hints.every(isNonEmptyString);
  if (!hintsOk) errors.push('hints must be 3 or 4 non-empty strings');
  const answer = validateAnswer(own(raw, 'answer'), errors);

  const optional: Partial<Pick<Problem, 'subtopics' | 'related' | 'estMinutes'>> = {};
  for (const key of ['subtopics', 'related'] as const) {
    const v = own(raw, key);
    if (v === undefined) continue;
    if (isStringArray(v)) optional[key] = [...v];
    else errors.push(`${key} must be an array of strings`);
  }
  const est = own(raw, 'estMinutes');
  if (est !== undefined) {
    if (isFiniteNumber(est) && est > 0) optional.estMinutes = est;
    else errors.push('estMinutes must be a positive number');
  }

  if (
    errors.length > 0 ||
    !isSource(source) ||
    !isTopic(topic) ||
    !isDifficulty(difficulty) ||
    !answer
  ) {
    return err(errors);
  }
  return ok({
    id,
    source,
    topic,
    difficulty,
    title,
    statement,
    hints: [...(hints as string[])] as Problem['hints'],
    solution,
    answer,
    ...optional,
  });
}
