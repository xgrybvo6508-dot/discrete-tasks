import { err, ok, type Result } from '../result';
import type { Rational } from '../rational';
import { tokenize, type SyntaxError, type Token } from './tokenize';

export type BinaryOp = '+' | '-' | '*' | '/' | '^';
export type FunctionName = 'binom';

export type Node =
  | { readonly kind: 'num'; readonly value: Rational }
  | { readonly kind: 'var'; readonly name: string }
  | { readonly kind: 'neg'; readonly arg: Node }
  | { readonly kind: 'fact'; readonly arg: Node }
  | { readonly kind: 'bin'; readonly op: BinaryOp; readonly left: Node; readonly right: Node }
  | { readonly kind: 'call'; readonly fn: FunctionName; readonly args: readonly Node[] };

export interface ParseOptions {
  /** Allowed variable names, e.g. `['n']`. Empty means a plain number. */
  readonly variables: readonly string[];
}

const FUNCTIONS: ReadonlyMap<string, { fn: FunctionName; arity: number }> = new Map([
  ['binom', { fn: 'binom', arity: 2 }],
  ['C', { fn: 'binom', arity: 2 }],
]);

const MAX_DEPTH = 50;

type StackItem =
  | { kind: 'bin'; op: BinaryOp }
  | { kind: 'neg' }
  | { kind: 'lparen'; pos: number; fn: { fn: FunctionName; arity: number } | null; args: number };

const PRECEDENCE: Readonly<Record<BinaryOp | 'neg', number>> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  neg: 3,
  '^': 4,
};

const fail = (message: string, pos: number): Result<never, SyntaxError> => err({ message, pos });

export function parseExpression(source: string, options: ParseOptions): Result<Node, SyntaxError> {
  const tokens = tokenize(source);
  if (!tokens.ok) return tokens;
  if (tokens.value.length === 0) return fail('The input is empty.', 0);
  return parseTokens(tokens.value, new Set(options.variables));
}

function parseTokens(
  tokens: readonly Token[],
  variables: ReadonlySet<string>,
): Result<Node, SyntaxError> {
  const out: Node[] = [];
  const stack: StackItem[] = [];
  let expectOperand = true;
  let depth = 0;

  const apply = (item: StackItem): void => {
    if (item.kind === 'neg') {
      const arg = out.pop();
      if (arg) out.push({ kind: 'neg', arg });
    } else if (item.kind === 'bin') {
      const right = out.pop();
      const left = out.pop();
      if (left && right) out.push({ kind: 'bin', op: item.op, left, right });
    }
  };

  const pushBinary = (op: BinaryOp): void => {
    const p = PRECEDENCE[op];
    const rightAssoc = op === '^';
    for (let top = stack.at(-1); top && top.kind !== 'lparen'; top = stack.at(-1)) {
      const q = PRECEDENCE[top.kind === 'neg' ? 'neg' : top.op];
      if (q > p || (q === p && !rightAssoc)) apply(stack.pop() as StackItem);
      else break;
    }
    stack.push({ kind: 'bin', op });
  };

  /** Pops operators down to the nearest bracket and returns it (still on the stack). */
  const unwindToParen = (): Extract<StackItem, { kind: 'lparen' }> | null => {
    for (let top = stack.at(-1); top; top = stack.at(-1)) {
      if (top.kind === 'lparen') return top;
      apply(stack.pop() as StackItem);
    }
    return null;
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] as Token;
    const startsOperand = t.kind === 'num' || t.kind === 'name' || t.kind === 'lparen';

    if (!expectOperand && startsOperand) {
      if (t.kind === 'num')
        return fail('Two numbers are next to each other. Add an operator.', t.pos);
      pushBinary('*');
      expectOperand = true;
    }

    if (t.kind === 'num') {
      out.push({ kind: 'num', value: t.value });
      expectOperand = false;
    } else if (t.kind === 'name') {
      const fn = FUNCTIONS.get(t.name);
      if (fn) {
        const next = tokens[i + 1];
        if (next?.kind !== 'lparen')
          return fail(`Write ${t.name} with brackets, like ${t.name}(5, 2).`, t.pos);
        if (++depth > MAX_DEPTH) return fail('There are too many nested brackets.', t.pos);
        stack.push({ kind: 'lparen', pos: next.pos, fn, args: 1 });
        i++;
        expectOperand = true;
      } else if (variables.has(t.name)) {
        out.push({ kind: 'var', name: t.name });
        expectOperand = false;
      } else {
        const hint = variables.size > 0 ? ` Use ${[...variables].join(', ')}.` : '';
        return fail(`The name "${t.name}" is not known.${hint}`, t.pos);
      }
    } else if (t.kind === 'lparen') {
      if (++depth > MAX_DEPTH) return fail('There are too many nested brackets.', t.pos);
      stack.push({ kind: 'lparen', pos: t.pos, fn: null, args: 1 });
      expectOperand = true;
    } else if (t.kind === 'op') {
      if (expectOperand) {
        if (t.op === '-') stack.push({ kind: 'neg' });
        else if (t.op !== '+') return fail(`"${t.op}" needs a number before it.`, t.pos);
      } else if (t.op === '!') {
        const arg = out.pop();
        if (arg) out.push({ kind: 'fact', arg });
      } else {
        pushBinary(t.op);
        expectOperand = true;
      }
    } else if (t.kind === 'comma') {
      if (expectOperand) return fail('Something is missing before a comma.', t.pos);
      const paren = unwindToParen();
      if (!paren?.fn) return fail('Commas are only allowed inside binom(a, b).', t.pos);
      paren.args++;
      expectOperand = true;
    } else {
      if (expectOperand) return fail('Something is missing before a closing bracket.', t.pos);
      const paren = unwindToParen();
      if (!paren) return fail('A closing bracket has no opening bracket.', t.pos);
      stack.pop();
      depth--;
      if (paren.fn) {
        if (paren.args !== paren.fn.arity) {
          return fail(
            `binom needs exactly ${paren.fn.arity} numbers, like binom(5, 2).`,
            paren.pos,
          );
        }
        const args = out.splice(out.length - paren.args, paren.args);
        out.push({ kind: 'call', fn: paren.fn.fn, args });
      }
      expectOperand = false;
    }
  }

  if (expectOperand) return fail('The input ends too early.', tokens.at(-1)?.pos ?? 0);
  for (let top = stack.pop(); top; top = stack.pop()) {
    if (top.kind === 'lparen') return fail('A bracket is not closed.', top.pos);
    apply(top);
  }
  const root = out[0];
  if (out.length !== 1 || !root) return fail('The input could not be read.', 0);
  return ok(root);
}
