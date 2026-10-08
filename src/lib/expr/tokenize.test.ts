import { describe, expect, it } from 'vitest';
import { toString } from '../rational';
import { MAX_INPUT_LENGTH, tokenize, type Token } from './tokenize';

function describeTokens(source: string): string[] {
  const r = tokenize(source);
  if (!r.ok) throw new Error(r.error.message);
  return r.value.map((t: Token) => {
    switch (t.kind) {
      case 'num':
        return `num:${toString(t.value)}`;
      case 'name':
        return `name:${t.name}`;
      case 'op':
        return `op:${t.op}`;
      default:
        return t.kind;
    }
  });
}

function errorOf(source: string): { message: string; pos: number } {
  const r = tokenize(source);
  if (r.ok) throw new Error('expected a syntax error');
  return r.error;
}

describe('tokenize', () => {
  it('splits numbers, names, operators, brackets and commas', () => {
    expect(describeTokens('2n + binom(n, 2)!')).toEqual([
      'num:2',
      'name:n',
      'op:+',
      'name:binom',
      'lparen',
      'name:n',
      'comma',
      'num:2',
      'rparen',
      'op:!',
    ]);
  });

  it('reads decimals as exact rationals', () => {
    expect(describeTokens('0.375 .5 5.')).toEqual(['num:3/8', 'num:1/2', 'num:5']);
  });

  it('records the position of each token', () => {
    const r = tokenize(' 12+n');
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.map((t) => t.pos)).toEqual([1, 3, 4]);
  });

  it('reads ** as ^', () => {
    expect(describeTokens('2**3')).toEqual(['num:2', 'op:^', 'num:3']);
  });

  it('maps unicode operators and other brackets to the basic ones', () => {
    expect(describeTokens('3×4·5⋅6∗7÷8−9–1')).toEqual([
      'num:3',
      'op:*',
      'num:4',
      'op:*',
      'num:5',
      'op:*',
      'num:6',
      'op:*',
      'num:7',
      'op:/',
      'num:8',
      'op:-',
      'num:9',
      'op:-',
      'num:1',
    ]);
    expect(describeTokens('[{()}]')).toEqual([
      'lparen',
      'lparen',
      'lparen',
      'rparen',
      'rparen',
      'rparen',
    ]);
  });

  it('skips all kinds of whitespace', () => {
    expect(describeTokens('\t1\n+\u00a02 ')).toEqual(['num:1', 'op:+', 'num:2']);
  });

  it('reads letter runs as one name', () => {
    expect(describeTokens('constructor')).toEqual(['name:constructor']);
  });

  it('accepts the empty string as no tokens', () => {
    expect(describeTokens('')).toEqual([]);
  });

  it.each(['$', '_', '=', '&', ';', '"', '\\', '😀'])('rejects the symbol %j', (s) => {
    const e = errorOf(`1${s}2`);
    expect(e.pos).toBe(1);
    expect(e.message).toMatch(/^The symbol ".*" is not supported\.$/);
  });

  it('names the unsupported symbol', () => {
    expect(errorOf('n=2').message).toBe('The symbol "=" is not supported.');
  });

  it('rejects a lone decimal point', () => {
    expect(errorOf('1+.').message).toBe('A number is not written correctly.');
  });

  it('rejects input longer than 500 characters', () => {
    expect(MAX_INPUT_LENGTH).toBe(500);
    expect(tokenize('1'.repeat(500)).ok).toBe(true);
    expect(errorOf('1+'.repeat(300)).message).toBe('The input is longer than 500 characters.');
  });
});
