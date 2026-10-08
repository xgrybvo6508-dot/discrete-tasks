import { MINUTE_MS } from '../lib/time';
import type { Outcome, Quality, SelfAssessment } from './schema';

export interface QualityInput {
  readonly outcome: Outcome;
  readonly wrongChecks: number;
  readonly hintsUsed: number;
  readonly agentHints: number;
  readonly activeMs: number;
  /** True only if the solution was opened before the outcome was decided. */
  readonly solutionViewed: boolean;
  readonly selfAssessment?: SelfAssessment | undefined;
  readonly estMinutes?: number | undefined;
}

const SELF_SCORES: Readonly<Record<Exclude<SelfAssessment, 'got'>, Quality>> = {
  partly: 2,
  missed: 1,
};

const SELF_CAP = 4;
const CORRECT_FLOOR = 3;

const clampQuality = (q: number): Quality => Math.max(0, Math.min(5, Math.round(q))) as Quality;

/** Silent penalties for hints and slow solving. Never shown in the UI. */
function penalties(input: QualityInput): number {
  const hints = input.hintsUsed + input.agentHints;
  let p = 0;
  if (hints >= 1) p += 1;
  if (hints >= 3) p += 1;
  const est = input.estMinutes;
  if (est !== undefined && est > 0 && input.activeMs > 2 * est * MINUTE_MS) p += 1;
  return p;
}

/**
 * Maps an attempt to an SM-2 quality score (0..5). A correct answer never drops below 3,
 * so it never counts as a lapse. Skips return 0 but never reach the scheduler.
 */
export function qualityFor(input: QualityInput): Quality {
  if (input.outcome === 'skipped') return 0;
  if (input.selfAssessment !== undefined) {
    if (input.selfAssessment !== 'got') return SELF_SCORES[input.selfAssessment];
    return clampQuality(Math.max(CORRECT_FLOOR, Math.min(SELF_CAP, 5 - penalties(input))));
  }
  if (input.outcome === 'partial') return 2;
  if (input.outcome === 'incorrect') return 1;
  if (input.solutionViewed) return 1;
  const base = Math.max(CORRECT_FLOOR, 5 - Math.max(0, input.wrongChecks));
  return clampQuality(Math.max(CORRECT_FLOOR, base - penalties(input)));
}
