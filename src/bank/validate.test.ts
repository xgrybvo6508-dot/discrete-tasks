import { describe, expect, it } from 'vitest';
import { makeProblem } from '../memory/testing';
import type { Problem } from './types';
import { validateProblem } from './validate';

/** A JSON-like copy of a valid problem that tests can break freely. */
function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...(structuredClone(makeProblem()) as unknown as Record<string, unknown>),
    ...overrides,
  };
}

function rawAnswer(answer: Record<string, unknown>): Record<string, unknown> {
  return raw({ answer });
}

function errorsOf(x: unknown): string[] {
  const r = validateProblem(x);
  if (r.ok) throw new Error('expected the problem to be rejected');
  return r.error;
}

describe('validateProblem: valid problems', () => {
  it('accepts a valid problem and returns an equal copy', () => {
    const p = makeProblem({ subtopics: ['trees'], related: ['graph-002'] });
    const r = validateProblem(p);
    if (!r.ok) throw new Error(r.error.join('; '));
    expect(r.value).toEqual(p);
    expect(r.value).not.toBe(p);
    expect(r.value.hints).not.toBe(p.hints);
    expect(r.value.answer).not.toBe(p.answer);
  });

  it('strips unknown fields at the top level and in the answer', () => {
    const r = validateProblem(
      raw({
        apiKey: 'x',
        extra: 1,
        answer: { type: 'numeric', canonical: 16, display: '16', secret: true },
      }),
    );
    if (!r.ok) throw new Error(r.error.join('; '));
    expect(r.value).not.toHaveProperty('apiKey');
    expect(r.value).not.toHaveProperty('extra');
    expect(r.value.answer).not.toHaveProperty('secret');
  });

  it('accepts 4 hints and every answer type in its proper shape', () => {
    const answers: Problem['answer'][] = [
      { type: 'numeric', canonical: '3/8', display: '3/8' },
      { type: 'numeric', canonical: 0.5, display: '1/2', tolerance: 1e-9 },
      { type: 'expression', canonical: '2^(n+1)-2', display: '$2^{n+1}-2$', nRange: [0, 12] },
      { type: 'set', canonical: [1, 'b', 3], display: '{1, b, 3}', accepted: ['B=b'] },
      { type: 'proof', display: 'Proof', keyPoints: ['Base case', 'Inductive step'] },
    ];
    for (const answer of answers) {
      const p = makeProblem({ answer, hints: ['a', 'b', 'c', 'd'] });
      const r = validateProblem(p);
      if (!r.ok) throw new Error(`${answer.type}: ${r.error.join('; ')}`);
      expect(r.value).toEqual(p);
    }
  });

  it('accepts difficulties 3, 4 and 5 and both sources', () => {
    for (const difficulty of [3, 4, 5] as const) {
      expect(validateProblem(makeProblem({ difficulty })).ok).toBe(true);
    }
    expect(validateProblem(makeProblem({ source: 'ai', id: 'ai-graph-1' })).ok).toBe(true);
  });
});

describe('validateProblem: invalid problems', () => {
  it('rejects non-objects', () => {
    for (const v of [null, undefined, 'problem', 3, [makeProblem()]]) {
      expect(errorsOf(v)).toEqual(['problem must be an object']);
    }
  });

  it.each([
    'id',
    'source',
    'topic',
    'difficulty',
    'title',
    'statement',
    'hints',
    'solution',
    'answer',
  ])('rejects a missing %s', (key) => {
    const p = raw();
    delete p[key];
    expect(errorsOf(p).length).toBeGreaterThan(0);
  });

  it('rejects wrong types', () => {
    const cases: Record<string, unknown>[] = [
      { id: 7 },
      { id: '   ' },
      { source: 'web' },
      { topic: 'calculus' },
      { difficulty: '4' },
      { title: '' },
      { statement: ['text'] },
      { solution: null },
      { hints: 'one, two, three' },
      { hints: ['a', 'b', 3] },
      { hints: ['a', 'b', ' '] },
      { answer: 'sixteen' },
      { subtopics: 'trees' },
      { related: [1, 2] },
      { estMinutes: 0 },
      { estMinutes: '10' },
    ];
    for (const c of cases) expect(errorsOf(raw(c)).length, JSON.stringify(c)).toBeGreaterThan(0);
  });

  it('rejects 2 or 5 hints', () => {
    expect(errorsOf(raw({ hints: ['a', 'b'] }))).toContain(
      'hints must be 3 or 4 non-empty strings',
    );
    expect(errorsOf(raw({ hints: ['a', 'b', 'c', 'd', 'e'] }))).toContain(
      'hints must be 3 or 4 non-empty strings',
    );
  });

  it('rejects difficulty 2 or 6', () => {
    expect(errorsOf(raw({ difficulty: 2 }))).toContain('difficulty must be 3, 4 or 5');
    expect(errorsOf(raw({ difficulty: 6 }))).toContain('difficulty must be 3, 4 or 5');
  });

  it('rejects a set answer whose canonical is not an array', () => {
    expect(errorsOf(rawAnswer({ type: 'set', canonical: '{1,2}', display: '{1,2}' }))).toContain(
      'answer.canonical must be an array of numbers or strings for set answers',
    );
    expect(errorsOf(rawAnswer({ type: 'set', canonical: [1, null], display: 'x' })).length).toBe(1);
  });

  it('rejects a proof without keyPoints or with a canonical', () => {
    expect(errorsOf(rawAnswer({ type: 'proof', display: 'Proof' }))).toContain(
      'answer.keyPoints must be a non-empty array of strings for proofs',
    );
    expect(errorsOf(rawAnswer({ type: 'proof', display: 'Proof', keyPoints: [] })).length).toBe(1);
    expect(
      errorsOf(rawAnswer({ type: 'proof', display: 'P', keyPoints: ['k'], canonical: 'QED' })),
    ).toContain('answer.canonical must be left out for proofs');
  });

  it('rejects nRange on a numeric answer and malformed ranges on expressions', () => {
    expect(
      errorsOf(rawAnswer({ type: 'numeric', canonical: 16, display: '16', nRange: [1, 5] })),
    ).toContain('answer.nRange must be [lo, hi] with whole numbers lo <= hi, for expressions only');
    for (const nRange of [[5, 1], [1], [1, 2.5], 'all']) {
      const p = rawAnswer({ type: 'expression', canonical: 'n', display: 'n', nRange });
      expect(errorsOf(p).length, JSON.stringify(nRange)).toBe(1);
    }
  });

  it('rejects other answer-shape mistakes', () => {
    const cases: Record<string, unknown>[] = [
      { type: 'essay', display: 'x' },
      { type: 'numeric', display: 'x' },
      { type: 'numeric', canonical: 16, display: '' },
      { type: 'expression', canonical: 5, display: '5' },
      { type: 'set', canonical: [1], display: '1', tolerance: 0.1 },
      { type: 'numeric', canonical: 1, display: '1', tolerance: -1 },
      { type: 'numeric', canonical: 1, display: '1', accepted: 'one' },
      { type: 'numeric', canonical: NaN, display: 'NaN' },
    ];
    for (const a of cases)
      expect(errorsOf(rawAnswer(a)).length, JSON.stringify(a)).toBeGreaterThan(0);
  });
});
