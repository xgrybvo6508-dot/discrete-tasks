import { isTopic } from '../bank/topics';
import type { Difficulty, Problem } from '../bank/types';
import { validateProblem } from '../bank/validate';
import {
  isBoolean,
  isFiniteNumber,
  isNonEmptyString,
  isOneOf,
  isRecord,
  isSafeKey,
  isString,
  own,
  type UnknownRecord,
} from '../lib/guards';
import { err, ok, type Result } from '../lib/result';
import { rebuildTopics } from './mastery';
import {
  CHECKED_BY,
  emptyMemory,
  MAX_ANSWER_TEXT,
  MEMORY_VERSION,
  OUTCOMES,
  QUALITIES,
  SELF_ASSESSMENTS,
  type Attempt,
  type CardState,
  type Memory,
} from './schema';

export interface MigrationError {
  readonly kind: 'corrupt' | 'future-version';
  readonly message: string;
  readonly details: readonly string[];
}

const isOutcome = isOneOf(OUTCOMES);
const isSelf = isOneOf(SELF_ASSESSMENTS);
const isCheckedBy = isOneOf(CHECKED_BY);
const isQuality = isOneOf(QUALITIES);
const isDifficulty = isOneOf<Difficulty>([3, 4, 5]);
const isSource = isOneOf<Attempt['source']>(['bank', 'ai']);
const isCount = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const isTime = (v: unknown): v is number => isFiniteNumber(v) && v >= 0;

export function parseAttempt(raw: unknown): Attempt | null {
  if (!isRecord(raw)) return null;
  const g = (k: string): unknown => own(raw, k);
  const [id, problemId, source, topic, difficulty] = [
    g('id'),
    g('problemId'),
    g('source'),
    g('topic'),
    g('difficulty'),
  ];
  const [startedAt, endedAt, activeMs] = [g('startedAt'), g('endedAt'), g('activeMs')];
  const [hintsUsed, agentHints, wrongChecks] = [g('hintsUsed'), g('agentHints'), g('wrongChecks')];
  const [solutionViewed, outcome, checkedBy, quality] = [
    g('solutionViewed'),
    g('outcome'),
    g('checkedBy'),
    g('quality'),
  ];
  const [selfAssessment, answerText] = [g('selfAssessment'), g('answerText')];
  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(problemId) ||
    !isSource(source) ||
    !isTopic(topic) ||
    !isDifficulty(difficulty) ||
    !isTime(startedAt) ||
    !isTime(endedAt) ||
    !isTime(activeMs) ||
    !isCount(hintsUsed) ||
    !isCount(agentHints) ||
    !isCount(wrongChecks) ||
    !isBoolean(solutionViewed) ||
    !isOutcome(outcome) ||
    !isCheckedBy(checkedBy) ||
    !isQuality(quality) ||
    (selfAssessment !== undefined && !isSelf(selfAssessment)) ||
    (answerText !== undefined && !isString(answerText))
  ) {
    return null;
  }
  const attempt: Attempt = {
    id,
    problemId,
    source,
    topic,
    difficulty,
    startedAt,
    endedAt,
    activeMs,
    hintsUsed,
    agentHints,
    wrongChecks,
    solutionViewed,
    outcome,
    checkedBy,
    quality,
  };
  if (selfAssessment !== undefined) attempt.selfAssessment = selfAssessment;
  if (answerText !== undefined) attempt.answerText = answerText.slice(0, MAX_ANSWER_TEXT);
  return attempt;
}

export function parseCard(raw: unknown): CardState | null {
  if (!isRecord(raw)) return null;
  const g = (k: string): unknown => own(raw, k);
  const [problemId, ease, intervalDays, reps, lapses] = [
    g('problemId'),
    g('ease'),
    g('intervalDays'),
    g('reps'),
    g('lapses'),
  ];
  const [dueAt, lastSeenAt, lastOutcome] = [g('dueAt'), g('lastSeenAt'), g('lastOutcome')];
  if (
    !isNonEmptyString(problemId) ||
    !isFiniteNumber(ease) ||
    !isCount(intervalDays) ||
    !isCount(reps) ||
    !isCount(lapses) ||
    !isTime(dueAt) ||
    !isTime(lastSeenAt) ||
    !isOutcome(lastOutcome)
  ) {
    return null;
  }
  return { problemId, ease, intervalDays, reps, lapses, dueAt, lastSeenAt, lastOutcome };
}

function collect<T>(
  items: unknown,
  parse: (x: unknown) => T | null,
  label: string,
  errors: string[],
): T[] {
  if (!Array.isArray(items)) {
    errors.push(`${label} is not a list`);
    return [];
  }
  const out: T[] = [];
  items.forEach((item, i) => {
    const parsed = parse(item);
    if (parsed === null) errors.push(`${label}[${i}] is not valid`);
    else out.push(parsed);
  });
  return out;
}

/** Validates a version 1 blob and returns a clean copy. Unknown fields are not kept. */
function readV1(raw: UnknownRecord): Result<Memory, MigrationError> {
  const errors: string[] = [];
  const createdAt = own(raw, 'createdAt');
  const updatedAt = own(raw, 'updatedAt');
  const lastExportAt = own(raw, 'lastExportAt');
  if (!isTime(createdAt)) errors.push('createdAt is not valid');
  if (!isTime(updatedAt)) errors.push('updatedAt is not valid');
  if (lastExportAt !== null && !isTime(lastExportAt)) errors.push('lastExportAt is not valid');

  const attempts = collect(own(raw, 'attempts'), parseAttempt, 'attempts', errors);
  const aiProblems = collect(
    own(raw, 'aiProblems'),
    (x): Problem | null => {
      const r = validateProblem(x);
      return r.ok && r.value.source === 'ai' ? r.value : null;
    },
    'aiProblems',
    errors,
  );
  const cards: Record<string, CardState> = {};
  const rawCards = own(raw, 'cards');
  if (!isRecord(rawCards)) errors.push('cards is not an object');
  else {
    for (const key of Object.keys(rawCards)) {
      const card = parseCard(own(rawCards, key));
      if (!card || card.problemId !== key || !isSafeKey(key))
        errors.push(`cards.${key} is not valid`);
      else cards[key] = card;
    }
  }

  if (errors.length > 0 || !isTime(createdAt) || !isTime(updatedAt)) {
    return err({ kind: 'corrupt', message: 'Saved data could not be read.', details: errors });
  }
  return ok({
    version: MEMORY_VERSION,
    createdAt,
    updatedAt,
    attempts,
    cards,
    topics: rebuildTopics(attempts),
    aiProblems,
    lastExportAt: isTime(lastExportAt) ? lastExportAt : null,
  });
}

type Step = (data: unknown, now: number) => unknown;

/** STEPS[v] upgrades version v to v + 1. Version 0 means "nothing saved yet". */
const STEPS: readonly Step[] = [(_data, now) => emptyMemory(now)];

function versionOf(raw: unknown): number | null {
  if (raw === undefined || raw === null) return 0;
  if (!isRecord(raw)) return null;
  const v = own(raw, 'version');
  return Number.isSafeInteger(v) && (v as number) >= 1 ? (v as number) : null;
}

/** Brings any saved blob up to the current version. Never drops data silently. */
export function migrate(raw: unknown, now: number): Result<Memory, MigrationError> {
  let version = versionOf(raw);
  if (version === null) {
    return err({
      kind: 'corrupt',
      message: 'Saved data could not be read.',
      details: ['missing or bad version'],
    });
  }
  if (version > MEMORY_VERSION) {
    return err({
      kind: 'future-version',
      message: 'Saved data comes from a newer version of the app.',
      details: [`version ${version}`],
    });
  }
  let data = raw;
  while (version < MEMORY_VERSION) {
    const step = STEPS[version];
    if (!step)
      return err({
        kind: 'corrupt',
        message: 'Saved data could not be read.',
        details: ['no migration'],
      });
    data = step(data, now);
    version++;
  }
  if (!isRecord(data)) {
    return err({
      kind: 'corrupt',
      message: 'Saved data could not be read.',
      details: ['not an object'],
    });
  }
  return readV1(data);
}
