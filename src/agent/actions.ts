import { TOPIC_PREFIXES } from '../bank/topics';
import type { Difficulty, Problem, Topic } from '../bank/types';
import { checkAnswer, type CheckResult } from '../lib/check';
import { isNonEmptyString, isOneOf, own } from '../lib/guards';
import { newId } from '../lib/ids';
import type { Rng } from '../lib/random';
import { err, ok, type Result } from '../lib/result';
import type { AgentMemorySummary } from '../memory/summary';
import type { AgentClient } from './client';
import { AgentError } from './errors';
import { parseJsonObject } from './extract-json';
import {
  checkMessages,
  CONNECTION_MESSAGES,
  generateProblemMessages,
  hintMessages,
} from './prompts';
import { jsonModeFor, type Settings } from './settings';
import { hintLeaksAnswer, validateGeneratedProblem } from './validate-generated';

export const GENERATE_TIMEOUT_MS = 45_000;
export const ACTION_TIMEOUT_MS = 30_000;
export const CONNECTION_TIMEOUT_MS = 15_000;
export const FALLBACK_MESSAGE =
  "The agent's problem could not be used. Here is one from the built-in bank.";
export const HINT_LEAK_MESSAGE =
  "The agent's hint gave away too much, so it is hidden. Try the next built-in hint.";

export interface ActionDeps {
  readonly client: AgentClient;
  readonly getSettings: () => Settings;
  readonly rng: Rng;
  readonly fallbackProblem?: (topic: Topic, difficulty: Difficulty) => Problem | null;
  readonly onGenerated?: (problem: Problem) => void;
}

export interface GenerateOutcome {
  readonly problem: Problem;
  readonly source: 'agent' | 'bank';
  readonly message?: string;
}

export interface HintOutcome {
  readonly hint: string;
  readonly hidden: boolean;
}

export interface AgentVerdict {
  readonly verdict: 'correct' | 'partial' | 'incorrect';
  readonly feedback: string;
  readonly nextStep: string;
}

export type CheckOutcome =
  | { readonly source: 'local'; readonly result: CheckResult }
  | ({ readonly source: 'agent' } & AgentVerdict);

function fallback(
  deps: ActionDeps,
  topic: Topic,
  difficulty: Difficulty,
  error: AgentError,
): Result<GenerateOutcome, AgentError> {
  const problem = deps.fallbackProblem?.(topic, difficulty);
  return problem ? ok({ problem, source: 'bank', message: FALLBACK_MESSAGE }) : err(error);
}

export async function generateProblem(
  deps: ActionDeps,
  topic: Topic,
  difficulty: Difficulty,
  summary: AgentMemorySummary,
): Promise<Result<GenerateOutcome, AgentError>> {
  const settings = deps.getSettings();
  let validationErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const previousErrors = validationErrors;
    validationErrors = [];
    const completion = await deps.client.complete(settings, {
      messages: generateProblemMessages(topic, difficulty, summary, previousErrors),
      temperature: 0.8,
      maxTokens: 1800,
      timeoutMs: GENERATE_TIMEOUT_MS,
      jsonMode: jsonModeFor(settings),
    });
    if (!completion.ok) return fallback(deps, topic, difficulty, completion.error);
    const parsed = parseJsonObject(completion.value);
    if (!parsed.ok) {
      validationErrors = [parsed.error];
      continue;
    }
    const checked = validateGeneratedProblem(parsed.value);
    if (!checked.ok) {
      validationErrors = [...checked.error];
      continue;
    }
    if (checked.value.problem.topic !== topic) validationErrors.push(`topic must be ${topic}`);
    if (checked.value.problem.difficulty !== difficulty)
      validationErrors.push(`difficulty must be ${difficulty}`);
    if (validationErrors.length > 0) continue;
    const problem: Problem = {
      ...checked.value.problem,
      id: `ai-${TOPIC_PREFIXES[topic]}-${newId(deps.rng)}`,
      source: 'ai',
    };
    deps.onGenerated?.(problem);
    return ok({ problem, source: 'agent' });
  }
  return fallback(deps, topic, difficulty, new AgentError('invalid-json'));
}

export async function hint(
  deps: ActionDeps,
  problem: Problem,
  step: number,
  userWork: string,
): Promise<Result<HintOutcome, AgentError>> {
  const settings = deps.getSettings();
  const completion = await deps.client.complete(settings, {
    messages: hintMessages(problem, step, problem.hints.slice(0, Math.max(0, step)), userWork),
    temperature: 0.3,
    maxTokens: 220,
    timeoutMs: ACTION_TIMEOUT_MS,
    jsonMode: jsonModeFor(settings),
  });
  if (!completion.ok) return completion;
  const parsed = parseJsonObject(completion.value);
  if (!parsed.ok) return err(new AgentError('invalid-json'));
  const value = own(parsed.value, 'hint');
  if (!isNonEmptyString(value)) return err(new AgentError('invalid-json'));
  return hintLeaksAnswer(problem, value)
    ? ok({ hint: HINT_LEAK_MESSAGE, hidden: true })
    : ok({ hint: value, hidden: false });
}

const isVerdict = isOneOf<AgentVerdict['verdict']>(['correct', 'partial', 'incorrect']);

function readVerdict(raw: string): Result<AgentVerdict, AgentError> {
  const parsed = parseJsonObject(raw);
  if (!parsed.ok) return err(new AgentError('invalid-json'));
  const verdict = own(parsed.value, 'verdict');
  const feedback = own(parsed.value, 'feedback');
  const nextStep = own(parsed.value, 'nextStep');
  return isVerdict(verdict) && isNonEmptyString(feedback) && isNonEmptyString(nextStep)
    ? ok({ verdict, feedback, nextStep })
    : err(new AgentError('invalid-json'));
}

export async function check(
  deps: ActionDeps,
  problem: Problem,
  userAnswerOrProof: string,
): Promise<Result<CheckOutcome, AgentError>> {
  if (problem.answer.type !== 'proof') {
    return ok({ source: 'local', result: checkAnswer(problem.answer, userAnswerOrProof) });
  }
  const settings = deps.getSettings();
  const completion = await deps.client.complete(settings, {
    messages: checkMessages(problem, userAnswerOrProof),
    temperature: 0.2,
    maxTokens: 500,
    timeoutMs: ACTION_TIMEOUT_MS,
    jsonMode: jsonModeFor(settings),
  });
  if (!completion.ok) return completion;
  const verdict = readVerdict(completion.value);
  return verdict.ok ? ok({ source: 'agent', ...verdict.value }) : verdict;
}

export async function testConnection(
  deps: Pick<ActionDeps, 'client' | 'getSettings'>,
): Promise<Result<string, AgentError>> {
  const result = await deps.client.complete(deps.getSettings(), {
    messages: CONNECTION_MESSAGES,
    temperature: 0,
    maxTokens: 5,
    timeoutMs: CONNECTION_TIMEOUT_MS,
  });
  return result.ok ? ok('Connected.') : result;
}
