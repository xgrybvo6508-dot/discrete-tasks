import { err, ok, type Result } from '../result';
import {
  add,
  binomial,
  checkSize,
  div,
  factorial,
  MathError,
  mul,
  neg,
  pow,
  sub,
  type MathErrorKind,
  type Rational,
} from '../rational';
import type { Node } from './parse';

export const MAX_FACTORIAL = 200;
export const MAX_BINOM_K = 4096;

export interface EvalError {
  readonly kind: MathErrorKind | 'unbound';
  readonly message: string;
}

export type Env = ReadonlyMap<string, Rational>;

class UnboundError extends Error {
  override readonly name = 'UnboundError';
}

/** Exact evaluation. Never throws; every failure is a typed EvalError. */
export function evaluate(node: Node, env: Env = new Map()): Result<Rational, EvalError> {
  try {
    return ok(run(node, env));
  } catch (e) {
    if (e instanceof MathError) return err({ kind: e.kind, message: e.message });
    if (e instanceof UnboundError) return err({ kind: 'unbound', message: e.message });
    if (e instanceof RangeError)
      return err({ kind: 'too-large', message: 'The number is too large.' });
    throw e;
  }
}

function run(node: Node, env: Env): Rational {
  switch (node.kind) {
    case 'num':
      return node.value;
    case 'var': {
      const v = env.get(node.name);
      if (!v) throw new UnboundError(`No value for ${node.name}.`);
      return v;
    }
    case 'neg':
      return neg(run(node.arg, env));
    case 'fact':
      return factorial(run(node.arg, env), MAX_FACTORIAL);
    case 'call': {
      const [a, b] = node.args;
      if (!a || !b) throw new MathError('undefined', 'binom needs two numbers.');
      return binomial(run(a, env), run(b, env), MAX_BINOM_K);
    }
    case 'bin': {
      const l = run(node.left, env);
      const r = run(node.right, env);
      switch (node.op) {
        case '+':
          return checkSize(add(l, r));
        case '-':
          return checkSize(sub(l, r));
        case '*':
          return checkSize(mul(l, r));
        case '/':
          return checkSize(div(l, r));
        case '^':
          return pow(l, r);
      }
    }
  }
}
