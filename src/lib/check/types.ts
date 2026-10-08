export type CheckStatus = 'correct' | 'incorrect' | 'unparsed';

export interface CheckResult {
  readonly status: CheckStatus;
  readonly message: string;
  readonly detail?: string;
}

export const MESSAGES = {
  correct: 'Correct.',
  incorrect: 'Not quite. Want a hint?',
  empty: 'Type an answer first.',
  number: 'I could not read this as a number. Try a form like 42, 3/8 or 2^10.',
  formula: 'I could not read this as a formula in n. Try a form like 2^n - 1 or binom(n, 2).',
  fewPoints: 'I could only check this formula at a few values of n. Try another way to write it.',
  set: 'I could not read this as a list. Separate the items with commas, like {1, 4, 9}.',
  stored: 'The saved answer for this problem could not be read, so it cannot be checked here.',
  proof: 'Proofs are not checked automatically. Compare your proof with the model solution.',
} as const;

export const correct = (detail?: string): CheckResult =>
  detail
    ? { status: 'correct', message: MESSAGES.correct, detail }
    : { status: 'correct', message: MESSAGES.correct };

export const incorrect = (detail?: string): CheckResult =>
  detail
    ? { status: 'incorrect', message: MESSAGES.incorrect, detail }
    : { status: 'incorrect', message: MESSAGES.incorrect };

export const unparsed = (message: string, detail?: string): CheckResult =>
  detail ? { status: 'unparsed', message, detail } : { status: 'unparsed', message };

/** Lowercase, no whitespace. Used to compare literal accepted inputs. */
export const squash = (text: string): string => text.toLowerCase().replace(/\s+/g, '');

export function matchesAccepted(input: string, accepted: readonly string[] | undefined): boolean {
  if (!accepted || accepted.length === 0) return false;
  const s = squash(input);
  return accepted.some((a) => squash(a) === s);
}
