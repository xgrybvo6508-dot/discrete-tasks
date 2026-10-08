import { err, ok, type Result } from '../result';
import { parseRational, type Rational } from '../rational';

export type Operator = '+' | '-' | '*' | '/' | '^' | '!';

export type Token =
  | { kind: 'num'; value: Rational; pos: number }
  | { kind: 'name'; name: string; pos: number }
  | { kind: 'op'; op: Operator; pos: number }
  | { kind: 'lparen'; pos: number }
  | { kind: 'rparen'; pos: number }
  | { kind: 'comma'; pos: number };

export const MAX_INPUT_LENGTH = 500;

export interface SyntaxError {
  readonly message: string;
  readonly pos: number;
}

const ALIASES: Readonly<Record<string, string>> = {
  '×': '*',
  '·': '*',
  '⋅': '*',
  '∗': '*',
  '÷': '/',
  '−': '-',
  '–': '-',
  '[': '(',
  ']': ')',
  '{': '(',
  '}': ')',
};

const OPERATORS = new Set<string>(['+', '-', '*', '/', '^', '!']);

export function tokenize(source: string): Result<Token[], SyntaxError> {
  if (source.length > MAX_INPUT_LENGTH) {
    return err({ message: `The input is longer than ${MAX_INPUT_LENGTH} characters.`, pos: 0 });
  }
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const raw = source[i] ?? '';
    const c = ALIASES[raw] ?? raw;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '*' && source[i + 1] === '*') {
      tokens.push({ kind: 'op', op: '^', pos: i });
      i += 2;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)/.exec(source.slice(i));
      const text = m?.[0];
      const value = text === undefined ? null : parseRational(text);
      if (text === undefined || value === null)
        return err({ message: 'A number is not written correctly.', pos: i });
      tokens.push({ kind: 'num', value, pos: i });
      i += text.length;
      continue;
    }
    if (/[A-Za-z]/.test(c)) {
      const m = /^[A-Za-z]+/.exec(source.slice(i));
      const name = m?.[0] ?? c;
      tokens.push({ kind: 'name', name, pos: i });
      i += name.length;
      continue;
    }
    if (OPERATORS.has(c)) {
      tokens.push({ kind: 'op', op: c as Operator, pos: i });
    } else if (c === '(') {
      tokens.push({ kind: 'lparen', pos: i });
    } else if (c === ')') {
      tokens.push({ kind: 'rparen', pos: i });
    } else if (c === ',') {
      tokens.push({ kind: 'comma', pos: i });
    } else {
      return err({ message: `The symbol "${raw}" is not supported.`, pos: i });
    }
    i++;
  }
  return ok(tokens);
}
