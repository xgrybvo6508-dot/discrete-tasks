import { describe, expect, it } from 'vitest';
import { rat, toString } from '../rational';
import { evaluate } from './evaluate';
import { parseExpression } from './parse';

function value(source: string, n?: number): string {
  const tree = parseExpression(source, { variables: n === undefined ? [] : ['n'] });
  if (!tree.ok) throw new Error(tree.error.message);
  const env = n === undefined ? new Map() : new Map([['n', rat(n)]]);
  const r = evaluate(tree.value, env);
  if (!r.ok) throw new Error(r.error.message);
  return toString(r.value);
}

function syntaxError(source: string, variables: readonly string[] = ['n']): string {
  const tree = parseExpression(source, { variables });
  if (tree.ok) throw new Error(`expected "${source}" to be rejected`);
  return tree.error.message;
}

describe('parseExpression: precedence', () => {
  it.each([
    ['1+2*3', '7'],
    ['(1+2)*3', '9'],
    ['10-4-3', '3'],
    ['12/3/2', '2'],
    ['2*3^2', '18'],
    ['2^3^2', '512'],
    ['-2^2', '-4'],
    ['(-2)^2', '4'],
    ['2^-3', '1/8'],
    ['2^-1^2', '1/2'],
    ['-2*3', '-6'],
    ['2*-3', '-6'],
    ['--2', '2'],
    ['+5', '5'],
    ['5+-2', '3'],
    ['2^3!', '64'],
    ['3!^2', '36'],
    ['-3!', '-6'],
    ['3!!', '720'],
    ['2**3**2', '512'],
    ['[2+1]{3-1}', '6'],
    ['3×4 − 2', '10'],
    ['1/3 + 1/3 + 1/3', '1'],
    ['0.1 + 0.2', '3/10'],
  ])('%s = %s', (source, expected) => {
    expect(value(source)).toBe(expected);
  });
});

describe('parseExpression: implicit multiplication', () => {
  it.each([
    ['2n', 5, '10'],
    ['(n+1)(n+2)', 3, '20'],
    ['n(n+1)', 4, '20'],
    ['2(n+1)', 4, '10'],
    ['2n^2', 3, '18'],
    ['-2n', 3, '-6'],
    ['-n^2', 3, '-9'],
    ['n n', 3, '9'],
    ['3n!', 3, '18'],
    ['n!n', 3, '18'],
    ['2^n n', 3, '24'],
    ['(n+1)!/(n-1)!', 4, '20'],
    ['2binom(n, 2)', 4, '12'],
    ['[n+1]{n-1}', 3, '8'],
  ])('%s at n = %d is %s', (source, n, expected) => {
    expect(value(source, n)).toBe(expected);
  });

  it('reads 1/2n left to right, as (1/2)n', () => {
    expect(value('1/2n', 4)).toBe('2');
  });

  it('rejects two numbers in a row', () => {
    expect(syntaxError('2 3')).toBe('Two numbers are next to each other. Add an operator.');
    expect(syntaxError('(2)3')).toBe('Two numbers are next to each other. Add an operator.');
  });
});

describe('parseExpression: functions', () => {
  it('reads binom and C', () => {
    expect(value('binom(5, 2)')).toBe('10');
    expect(value('C(5,2)')).toBe('10');
    expect(value('binom (5, 2)')).toBe('10');
    expect(value('binom(binom(4,2), 2)')).toBe('15');
    expect(value('binom(n+1, 2) - binom(n, 2)', 7)).toBe('7');
  });

  it('needs brackets after a function name', () => {
    expect(syntaxError('binom 5')).toBe('Write binom with brackets, like binom(5, 2).');
    expect(syntaxError('C')).toBe('Write C with brackets, like C(5, 2).');
  });

  it('needs exactly two arguments', () => {
    const message = 'binom needs exactly 2 numbers, like binom(5, 2).';
    expect(syntaxError('binom(5)')).toBe(message);
    expect(syntaxError('binom(1,2,3)')).toBe(message);
  });

  it('allows commas only inside binom', () => {
    expect(syntaxError('(1,2)')).toBe('Commas are only allowed inside binom(a, b).');
    expect(syntaxError('1,2')).toBe('Commas are only allowed inside binom(a, b).');
    expect(syntaxError('binom((1,2), 3)')).toBe('Commas are only allowed inside binom(a, b).');
    expect(syntaxError('binom(,2)')).toBe('Something is missing before a comma.');
  });
});

describe('parseExpression: syntax errors', () => {
  it.each([
    ['', 'The input is empty.'],
    ['   ', 'The input is empty.'],
    ['2+', 'The input ends too early.'],
    ['-', 'The input ends too early.'],
    ['(', 'The input ends too early.'],
    ['(1', 'A bracket is not closed.'],
    ['binom(1, 2', 'A bracket is not closed.'],
    [')', 'Something is missing before a closing bracket.'],
    ['()', 'Something is missing before a closing bracket.'],
    ['1)', 'A closing bracket has no opening bracket.'],
    ['*2', '"*" needs a number before it.'],
    ['!', '"!" needs a number before it.'],
    ['2*/3', '"/" needs a number before it.'],
  ])('%j gives %j', (source, message) => {
    expect(syntaxError(source)).toBe(message);
  });

  it('reports where the problem is', () => {
    const tree = parseExpression('n + x', { variables: ['n'] });
    if (tree.ok) throw new Error('expected an error');
    expect(tree.error.pos).toBe(4);
  });
});

describe('parseExpression: unknown names and malicious input', () => {
  it('rejects names that are not allowed variables', () => {
    expect(syntaxError('x + 1')).toBe('The name "x" is not known. Use n.');
    expect(syntaxError('n + 1', [])).toBe('The name "n" is not known.');
  });

  it.each([
    'constructor',
    'alert(1)',
    'toString',
    'valueOf()',
    'prototype',
    'hasOwnProperty(n)',
    'eval(1)',
    'Function(1)',
    'window',
    'process',
  ])('rejects %j as an unknown name', (source) => {
    expect(syntaxError(source)).toMatch(/^The name "[A-Za-z]+" is not known\./);
  });

  it.each(['__proto__', 'n.constructor', 'n["x"]', '`1`', "'1'", 'n;1', 'a=>1', '1//2'])(
    'rejects %j',
    (source) => {
      expect(parseExpression(source, { variables: ['n'] }).ok).toBe(false);
    },
  );

  it('rejects input longer than 500 characters', () => {
    expect(syntaxError('1+'.repeat(300) + '1')).toBe('The input is longer than 500 characters.');
  });

  it('allows 50 nested brackets and rejects 60', () => {
    expect(value(`${'('.repeat(50)}1${')'.repeat(50)}`)).toBe('1');
    expect(syntaxError(`${'('.repeat(60)}1${')'.repeat(60)}`)).toBe(
      'There are too many nested brackets.',
    );
    expect(syntaxError(`${'binom('.repeat(51)}1`)).toBe('There are too many nested brackets.');
  });

  it('counts depth, not the total number of brackets', () => {
    expect(value('(1)+'.repeat(80) + '1')).toBe('81');
  });
});
