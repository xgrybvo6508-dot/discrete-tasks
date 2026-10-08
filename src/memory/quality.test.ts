import { describe, expect, it } from 'vitest';
import { MINUTE_MS } from '../lib/time';
import { qualityFor, type QualityInput } from './quality';

function q(overrides: Partial<QualityInput> = {}): number {
  return qualityFor({
    outcome: 'correct',
    wrongChecks: 0,
    hintsUsed: 0,
    agentHints: 0,
    activeMs: 5 * MINUTE_MS,
    solutionViewed: false,
    estMinutes: 10,
    ...overrides,
  });
}

const SLOW = 20 * MINUTE_MS + 1;

describe('qualityFor: correct answers', () => {
  it.each([
    ['first check', {}, 5],
    ['1 wrong check', { wrongChecks: 1 }, 4],
    ['2 wrong checks', { wrongChecks: 2 }, 3],
    ['3 wrong checks', { wrongChecks: 3 }, 3],
    ['10 wrong checks', { wrongChecks: 10 }, 3],
    ['1 local hint', { hintsUsed: 1 }, 4],
    ['2 local hints', { hintsUsed: 2 }, 4],
    ['3 local hints', { hintsUsed: 3 }, 3],
    ['1 agent hint', { agentHints: 1 }, 4],
    ['1 local + 2 agent hints', { hintsUsed: 1, agentHints: 2 }, 3],
    ['4 hints', { hintsUsed: 4 }, 3],
    ['slower than 2x estimate', { activeMs: SLOW }, 4],
    ['exactly 2x estimate', { activeMs: 20 * MINUTE_MS }, 5],
    ['slow with no estimate', { activeMs: SLOW, estMinutes: undefined }, 5],
    ['slow with a zero estimate', { activeMs: 10 * SLOW, estMinutes: 0 }, 5],
    ['1 wrong check + 1 hint', { wrongChecks: 1, hintsUsed: 1 }, 3],
    ['3 hints + slow', { hintsUsed: 3, activeMs: SLOW }, 3],
    ['2 wrong checks + 3 hints + slow', { wrongChecks: 2, hintsUsed: 3, activeMs: SLOW }, 3],
    ['solution viewed before the answer', { solutionViewed: true }, 1],
    ['solution viewed, with hints', { solutionViewed: true, hintsUsed: 3 }, 1],
  ] as const)('%s -> %i', (_name, overrides, expected) => {
    expect(q(overrides)).toBe(expected);
  });

  it('never scores a correct answer below 3 unless the solution was viewed', () => {
    for (let wrong = 0; wrong <= 6; wrong++) {
      for (let hints = 0; hints <= 5; hints++) {
        for (const activeMs of [MINUTE_MS, SLOW]) {
          expect(q({ wrongChecks: wrong, hintsUsed: hints, activeMs })).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});

describe('qualityFor: other outcomes', () => {
  it.each([
    ['incorrect (gave up)', { outcome: 'incorrect' }, 1],
    ['incorrect with the solution viewed', { outcome: 'incorrect', solutionViewed: true }, 1],
    ['partial', { outcome: 'partial' }, 2],
    ['partial with hints', { outcome: 'partial', hintsUsed: 3 }, 2],
    ['skipped', { outcome: 'skipped' }, 0],
    ['skipped with a self-assessment', { outcome: 'skipped', selfAssessment: 'got' }, 0],
  ] as const)('%s -> %i', (_name, overrides, expected) => {
    expect(q(overrides)).toBe(expected);
  });
});

describe('qualityFor: proof self-assessment', () => {
  it.each([
    ['got it', { selfAssessment: 'got' }, 4],
    ['got it with 1 hint', { selfAssessment: 'got', hintsUsed: 1 }, 4],
    ['got it with 2 hints', { selfAssessment: 'got', hintsUsed: 2 }, 4],
    ['got it with 3 hints', { selfAssessment: 'got', hintsUsed: 3 }, 3],
    ['got it with 1 hint, slow', { selfAssessment: 'got', hintsUsed: 1, activeMs: SLOW }, 3],
    ['got it with 3 hints, slow', { selfAssessment: 'got', hintsUsed: 3, activeMs: SLOW }, 3],
    ['partly', { selfAssessment: 'partly', outcome: 'partial' }, 2],
    ['partly with no hints', { selfAssessment: 'partly' }, 2],
    ['missed', { selfAssessment: 'missed', outcome: 'incorrect' }, 1],
    ['missed with hints', { selfAssessment: 'missed', hintsUsed: 4 }, 1],
  ] as const)('%s -> %i', (_name, overrides, expected) => {
    expect(q(overrides)).toBe(expected);
  });

  it('caps a self-assessed answer at 4', () => {
    expect(q({ selfAssessment: 'got' })).toBeLessThan(q({}));
  });
});
