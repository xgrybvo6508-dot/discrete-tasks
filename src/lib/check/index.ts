import { parseRational, toString } from '../rational';
import { checkExpression } from './expression';
import { checkNumeric } from './numeric';
import { checkSet } from './set';
import { MESSAGES, unparsed, type CheckResult } from './types';

export type { CheckResult, CheckStatus } from './types';
export { MESSAGES } from './types';

/** The part of a problem's answer that the local checkers need. */
export interface CheckableAnswer {
  readonly type: 'numeric' | 'expression' | 'set' | 'proof';
  readonly canonical?: number | string | readonly (number | string)[] | undefined;
  readonly accepted?: readonly string[] | undefined;
  readonly tolerance?: number | undefined;
  readonly nRange?: readonly [number, number] | undefined;
}

export const isAutoCheckable = (answer: CheckableAnswer): boolean => answer.type !== 'proof';

export function checkAnswer(answer: CheckableAnswer, input: string): CheckResult {
  const { canonical } = answer;
  switch (answer.type) {
    case 'proof':
      return unparsed(MESSAGES.proof);
    case 'numeric':
      if (typeof canonical !== 'number' && typeof canonical !== 'string')
        return unparsed(MESSAGES.stored);
      return checkNumeric(input, canonical, {
        tolerance: answer.tolerance,
        accepted: answer.accepted,
      });
    case 'expression':
      if (typeof canonical !== 'string') return unparsed(MESSAGES.stored);
      return checkExpression(input, canonical, {
        nRange: answer.nRange,
        accepted: answer.accepted,
      });
    case 'set':
      if (!Array.isArray(canonical)) return unparsed(MESSAGES.stored);
      return checkSet(input, canonical, { accepted: answer.accepted });
  }
}

/** The input a user would type for the canonical answer. Used to self-check stored answers. */
export function canonicalInput(answer: CheckableAnswer): string | null {
  const { canonical } = answer;
  if (canonical === undefined) return null;
  if (Array.isArray(canonical)) return `{${canonical.join(', ')}}`;
  const text = String(canonical);
  if (answer.type === 'numeric' && /e/i.test(text)) {
    const value = parseRational(text);
    if (value) return toString(value);
  }
  return text;
}
