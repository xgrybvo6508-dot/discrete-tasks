import { describe, expect, it } from 'vitest';
import { checkSet, normalizeItem, splitTopLevel } from './set';
import { MESSAGES } from './types';

const CORRECT = { status: 'correct', message: 'Correct.' };
const status = (input: string, canonical: readonly (number | string)[]): string =>
  checkSet(input, canonical).status;

describe('checkSet: order and spacing', () => {
  it.each([
    '{1, 4, 9}',
    '{9, 1,4}',
    '  { 1 ,  4 , 9 }  ',
    '1, 4, 9',
    '1 4 9',
    '{1 4 9}',
    '{1; 4; 9}',
    '\\{1, 4, 9\\}',
    '{4,9,1}',
  ])('%j equals {1, 4, 9}', (input) => {
    expect(checkSet(input, [1, 4, 9])).toEqual(CORRECT);
  });

  it('does not split a single expression on spaces', () => {
    expect(status('{1 + 1}', [2])).toBe('correct');
    expect(status('{2 ^ 3}', [8])).toBe('correct');
    expect(status('{2 3 5}', [2, 3, 5])).toBe('correct');
  });

  it('a missing or extra item is incorrect', () => {
    expect(checkSet('{1, 4}', [1, 4, 9])).toEqual({
      status: 'incorrect',
      message: 'Not quite. Want a hint?',
    });
    expect(status('{1, 4, 9, 16}', [1, 4, 9])).toBe('incorrect');
    expect(status('{1, 4, 8}', [1, 4, 9])).toBe('incorrect');
  });
});

describe('checkSet: item normalisation', () => {
  it('compares numbers as exact rationals', () => {
    expect(status('{6/2, 0.5, 2^2}', [3, '1/2', 4])).toBe('correct');
    expect(status('{3, 1/2}', ['6/2', 0.5])).toBe('correct');
    expect(status('{binom(5, 2)}', [10])).toBe('correct');
    expect(status('{binom[5, 2]}', [10])).toBe('correct');
  });

  it('compares text without case or spaces', () => {
    expect(status('{Alice, BOB}', ['alice', 'bob'])).toBe('correct');
    expect(status('{Bob Smith, Ann}', ['bobsmith', 'ann'])).toBe('correct');
    expect(status('{Bob Smith}', ['bob', 'smith'])).toBe('correct');
    expect(status('{alice}', ['bob'])).toBe('incorrect');
  });

  it('keeps tuples intact and normalises each component', () => {
    expect(checkSet('{(1, 2), (2,1)}', ['(1,2)', '(2, 1)'])).toEqual(CORRECT);
    expect(status('{(2/2, 4/2)}', ['(1,2)'])).toBe('correct');
    expect(status('{(1,2)}', ['(2,1)'])).toBe('incorrect');
    expect(status('{(1, 2), (3, 4)}', ['(1,2)'])).toBe('incorrect');
    expect(status('{((1, 2), 3)}', ['((1,2),3)'])).toBe('correct');
    expect(status('{(A, b)}', ['(a,B)'])).toBe('correct');
  });

  it('a bracketed single number is the number', () => {
    expect(status('{(5)}', [5])).toBe('correct');
  });
});

describe('checkSet: duplicates', () => {
  it('counts a repeated item once and says so', () => {
    expect(checkSet('{1, 3, 3}', [1, 3])).toEqual({
      status: 'correct',
      message: 'Correct.',
      detail: 'You listed 3 twice. I counted it once.',
    });
  });

  it('notices duplicates written in different forms', () => {
    expect(checkSet('{3, 3.0, 6/2}', [3]).detail).toBe('You listed 3 3 times. I counted it once.');
  });

  it('mentions each repeated item', () => {
    expect(checkSet('{1, 1, 2, 2}', [1, 2]).detail).toBe(
      'You listed 1 twice. I counted it once. You listed 2 twice. I counted it once.',
    );
  });

  it('keeps the note when the answer is wrong', () => {
    expect(checkSet('{5, 5}', [1])).toEqual({
      status: 'incorrect',
      message: 'Not quite. Want a hint?',
      detail: 'You listed 5 twice. I counted it once.',
    });
  });
});

describe('checkSet: aliases', () => {
  it('reads "alias=item" entries', () => {
    expect(checkSet('{1, phi}', [1, 4], { accepted: ['phi=4'] })).toEqual(CORRECT);
    expect(checkSet('{1, PHI}', [1, 4], { accepted: ['phi = 4'] }).status).toBe('correct');
    expect(checkSet('{1, phi}', [1, 4]).status).toBe('incorrect');
  });

  it('an alias and its item count as the same item', () => {
    expect(checkSet('{phi, 4}', [4], { accepted: ['phi=4'] }).detail).toBe(
      'You listed phi twice. I counted it once.',
    );
  });

  it('aliases can stand for tuples', () => {
    expect(checkSet('{a}', ['(1,2)'], { accepted: ['a=(1, 2)'] }).status).toBe('correct');
  });

  it('ignores entries without an alias name', () => {
    expect(checkSet('{4}', [4], { accepted: ['=4', 'four'] }).status).toBe('correct');
  });
});

describe('checkSet: empty set and bad input', () => {
  it.each(['{}', '{ }', '∅', 'empty', 'Empty', '\\emptyset', '\\varnothing', '{∅}', 'none'])(
    '%j is the empty set',
    (input) => {
      expect(checkSet(input, [])).toEqual(CORRECT);
    },
  );

  it('the empty set is not a non-empty set', () => {
    expect(status('{}', [1])).toBe('incorrect');
    expect(status('{1}', [])).toBe('incorrect');
  });

  it('empty input asks for an answer', () => {
    expect(checkSet('  ', [1])).toEqual({ status: 'unparsed', message: MESSAGES.empty });
  });

  it.each(['{1,,2}', '{1, 2,}', '{,1}', ',', '{1;;2}'])('%j has an empty item', (input) => {
    expect(checkSet(input, [1, 2])).toEqual({
      status: 'unparsed',
      message: 'I could not read this as a list. Separate the items with commas, like {1, 4, 9}.',
      detail: 'One of the items is empty. Check for an extra comma.',
    });
  });
});

describe('splitTopLevel', () => {
  it('splits only outside brackets', () => {
    expect(splitTopLevel('1, (2, 3); [4, 5], {6,7}')).toEqual(['1', '(2, 3)', '[4, 5]', '{6,7}']);
  });

  it('keeps going after an unbalanced closing bracket', () => {
    expect(splitTopLevel('1), 2')).toEqual(['1)', '2']);
  });
});

describe('normalizeItem', () => {
  it.each([
    ['6/2', '3'],
    [' 0.5 ', '1/2'],
    ['(1, 2/4)', '(1,1/2)'],
    ['((5))', '5'],
    ['Hello World', 'helloworld'],
    ['(1)+(2)', '3'],
  ])('%j becomes %j', (input, expected) => {
    expect(normalizeItem(input)).toBe(expected);
  });
});
