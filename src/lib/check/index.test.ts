import { describe, expect, it } from 'vitest';
import { evaluate } from '../expr/evaluate';
import { parseExpression } from '../expr/parse';
import { mulberry32, randomInt } from '../random';
import { rat } from '../rational';
import {
  canonicalInput,
  checkAnswer,
  isAutoCheckable,
  MESSAGES,
  type CheckableAnswer,
} from './index';

describe('checkAnswer', () => {
  it('dispatches to the checker for each type', () => {
    expect(checkAnswer({ type: 'numeric', canonical: '3/8' }, '0.375').status).toBe('correct');
    expect(checkAnswer({ type: 'expression', canonical: '2^n-1' }, '2^n - 1').status).toBe(
      'correct',
    );
    expect(checkAnswer({ type: 'set', canonical: [1, 2] }, '{2, 1}').status).toBe('correct');
  });

  it('passes options through', () => {
    expect(
      checkAnswer({ type: 'numeric', canonical: 3.14159, tolerance: 0.01 }, '3.14').status,
    ).toBe('correct');
    expect(checkAnswer({ type: 'numeric', canonical: 5, accepted: ['five'] }, 'Five').status).toBe(
      'correct',
    );
    expect(
      checkAnswer({ type: 'expression', canonical: 'n', nRange: [0, 5] }, 'n + n(n-1)').detail,
    ).toBe('Your formula matches for n = 0..1 but not for n = 2.');
    expect(checkAnswer({ type: 'set', canonical: [4], accepted: ['phi=4'] }, '{phi}').status).toBe(
      'correct',
    );
  });

  it('proofs are never checked automatically', () => {
    expect(checkAnswer({ type: 'proof' }, 'Assume the opposite...')).toEqual({
      status: 'unparsed',
      message: 'Proofs are not checked automatically. Compare your proof with the model solution.',
    });
    expect(isAutoCheckable({ type: 'proof' })).toBe(false);
    expect(isAutoCheckable({ type: 'set', canonical: [] })).toBe(true);
  });

  it.each<CheckableAnswer>([
    { type: 'numeric' },
    { type: 'numeric', canonical: [1, 2] },
    { type: 'expression', canonical: 5 },
    { type: 'expression' },
    { type: 'set', canonical: '1, 2' },
    { type: 'set' },
  ])('a canonical of the wrong shape is reported, not thrown (%j)', (answer) => {
    expect(checkAnswer(answer, '1')).toEqual({ status: 'unparsed', message: MESSAGES.stored });
  });

  it('does not throw on a fractional or odd nRange', () => {
    for (const nRange of [
      [0.5, 8.5],
      [NaN, 5],
      [-Infinity, Infinity],
      [10, 1],
    ] as const) {
      const r = checkAnswer({ type: 'expression', canonical: 'n', nRange }, 'n');
      expect(['correct', 'unparsed']).toContain(r.status);
    }
    expect(
      checkAnswer({ type: 'expression', canonical: 'n', nRange: [0.5, 8.5] }, 'n').status,
    ).toBe('correct');
  });
});

describe('canonicalInput', () => {
  it('writes the canonical answer as a user would type it', () => {
    expect(canonicalInput({ type: 'numeric', canonical: 42 })).toBe('42');
    expect(canonicalInput({ type: 'numeric', canonical: '3/8' })).toBe('3/8');
    expect(canonicalInput({ type: 'expression', canonical: '2^n - 1' })).toBe('2^n - 1');
    expect(canonicalInput({ type: 'set', canonical: [1, 4, 9] })).toBe('{1, 4, 9}');
    expect(canonicalInput({ type: 'set', canonical: [] })).toBe('{}');
    expect(canonicalInput({ type: 'proof' })).toBeNull();
  });

  it.each<CheckableAnswer>([
    { type: 'numeric', canonical: 42 },
    { type: 'numeric', canonical: -7 },
    { type: 'numeric', canonical: 0.375 },
    { type: 'numeric', canonical: '3/8' },
    { type: 'numeric', canonical: '2^10' },
    { type: 'numeric', canonical: 1e21 },
    { type: 'numeric', canonical: 1.5e-7 },
    { type: 'numeric', canonical: '1.5e-3' },
    { type: 'numeric', canonical: '2E3' },
    { type: 'expression', canonical: 'binom(2n,n)/(n+1)' },
    { type: 'expression', canonical: '(-1)^n n!' },
    { type: 'set', canonical: [1, '1/2', 'abc'] },
    { type: 'set', canonical: ['(1, 2)', '(2, 1)'] },
    { type: 'set', canonical: [] },
  ])('the canonical input of %j checks as correct', (answer) => {
    const input = canonicalInput(answer);
    if (input === null) throw new Error('expected an input');
    expect(checkAnswer(answer, input).status).toBe('correct');
  });
});

describe('fuzz: random input never throws', () => {
  const CHARS = [...'0123456789nnn+-*/^!()[]{},.abcxCe  '];
  const OPERANDS = [
    'n',
    'n',
    '2',
    '3',
    '10',
    '0',
    '(n+1)',
    '(2n)!',
    'binom(n,2)',
    'C(2n,n)',
    '(-1)',
  ];
  const OPERATORS = ['+', '-', '*', '/', '^', '^', '!', '-', ' ', '(', ')', ','];
  const TOKENS = [...OPERANDS, ...OPERANDS, ...OPERATORS];
  const rng = mulberry32(20261008);
  const randomString = (pieces: readonly string[]): string => {
    const length = randomInt(rng, 41);
    let s = '';
    for (let i = 0; i < length; i++) s += pieces[randomInt(rng, pieces.length)] ?? '';
    return s;
  };
  const inputs = [
    ...Array.from({ length: 2000 }, () => randomString(CHARS)),
    ...Array.from({ length: 2000 }, () => randomString(TOKENS).slice(0, 120)),
  ];

  const answers: readonly CheckableAnswer[] = [
    { type: 'numeric', canonical: '3/8' },
    { type: 'numeric', canonical: 1000, tolerance: 0.5 },
    { type: 'expression', canonical: 'binom(2n,n)/(n+1)' },
    { type: 'expression', canonical: '2^n - 1', nRange: [0, 6] },
    { type: 'set', canonical: [1, 2, '(1,2)'], accepted: ['x=1'] },
    { type: 'proof' },
  ];

  it('parseExpression and evaluate', () => {
    let parsed = 0;
    for (const source of inputs) {
      const tree = parseExpression(source, { variables: ['n'] });
      if (!tree.ok) {
        expect(typeof tree.error.message).toBe('string');
        continue;
      }
      parsed++;
      for (const n of [0, 3, 15]) {
        const r = evaluate(tree.value, new Map([['n', rat(n)]]));
        if (!r.ok) expect(['undefined', 'too-large', 'unsupported']).toContain(r.error.kind);
      }
    }
    expect(parsed).toBeGreaterThan(100);
  });

  it('checkAnswer for every answer type', () => {
    for (const source of inputs) {
      for (const answer of answers) {
        const r = checkAnswer(answer, source);
        expect(['correct', 'incorrect', 'unparsed']).toContain(r.status);
        expect(r.message.length).toBeGreaterThan(0);
      }
    }
  });
});
