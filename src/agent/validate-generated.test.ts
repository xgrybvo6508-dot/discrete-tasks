import { describe, expect, it } from 'vitest';
import { hintLeaksAnswer, validateGeneratedProblem } from './validate-generated';

const validNumeric = {
  topic: 'graphs',
  difficulty: 4,
  title: 'A constrained tree',
  statement: 'Count labelled trees with the stated property.',
  hints: ['Encode each tree.', 'Use a sequence representation.', 'Count the allowed codes.'],
  solution: 'The full count is $16$.',
  answer: { type: 'numeric', canonical: 16, display: '$16$' } as const,
  estMinutes: 12,
};

const validExpression = {
  topic: 'combinatorics',
  difficulty: 4,
  title: 'A family of subsets',
  statement: 'Find a formula in $n$.',
  hints: ['Split into two classes.', 'Build a recurrence.', 'Solve the recurrence.'],
  solution: 'The formula is $2^n$.',
  answer: { type: 'expression', canonical: '2^n', display: '$2^n$' },
  smallCases: [
    { n: 1, value: 2 },
    { n: 2, value: '4' },
    { n: 3, value: 8 },
    { n: 4, value: 16 },
  ],
};

describe('validateGeneratedProblem', () => {
  it('accepts a valid object and adds no id or source', () => {
    const result = validateGeneratedProblem(validNumeric);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.problem).toMatchObject(validNumeric);
      expect(result.value.problem).not.toHaveProperty('id');
      expect(result.value.problem).not.toHaveProperty('source');
    }
  });

  it.each([
    [{ ...validNumeric, title: '' }, 'title'],
    [{ ...validNumeric, difficulty: 2 }, 'difficulty'],
    [{ ...validNumeric, difficulty: 6 }, 'difficulty'],
    [{ ...validNumeric, hints: ['one', 'two'] }, 'hints'],
    [{ ...validNumeric, hints: ['1', '2', '3', '4', '5'] }, 'hints'],
    [{ ...validNumeric, answer: { type: 'numeric', display: 'x' } }, 'canonical'],
  ])('rejects malformed fields', (value, expected) => {
    const result = validateGeneratedProblem(value);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.join(' ')).toContain(expected);
  });

  it('catches answer leaks in hints', () => {
    const result = validateGeneratedProblem({
      ...validNumeric,
      hints: ['Encode the tree.', 'The answer is 16.', 'Now finish.'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Hint 2 reveals the answer');
    expect(hintLeaksAnswer({ answer: validNumeric.answer }, 'It equals $16$.')).toBe(true);
  });

  it('catches invalid TeX', () => {
    const result = validateGeneratedProblem({
      ...validNumeric,
      statement: 'Evaluate $\\notACommand{x}$.',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.some((e) => e.startsWith('Invalid TeX'))).toBe(true);
  });

  it('cross-checks four expression small cases', () => {
    expect(validateGeneratedProblem(validExpression).ok).toBe(true);
    const mismatch = validateGeneratedProblem({
      ...validExpression,
      smallCases: [...validExpression.smallCases.slice(0, 3), { n: 4, value: 15 }],
    });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.error.join(' ')).toContain('n = 4');
  });

  it('requires exactly four distinct small cases only for expressions', () => {
    const tooFew = validateGeneratedProblem({
      ...validExpression,
      smallCases: validExpression.smallCases.slice(0, 3),
    });
    expect(tooFew.ok).toBe(false);
    const unexpected = validateGeneratedProblem({ ...validNumeric, smallCases: [] });
    expect(unexpected.ok).toBe(false);
  });
});
