export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

function longest(sequence: readonly number[], increasing: boolean): number {
  const lengths = Array.from({ length: sequence.length }, () => 1);
  let best = 1;
  for (let j = 0; j < sequence.length; j += 1) {
    for (let i = 0; i < j; i += 1) {
      const extendsSequence = increasing
        ? sequence[i]! < sequence[j]!
        : sequence[i]! > sequence[j]!;
      if (extendsSequence) lengths[j] = Math.max(lengths[j]!, lengths[i]! + 1);
    }
    best = Math.max(best, lengths[j]!);
  }
  return best;
}

function checkPermutations(length: number, required: number): { ok: boolean; checked: number } {
  let ok = true;
  let checked = 0;
  const visit = (prefix: number[], unused: number): void => {
    if (!ok) return;
    if (prefix.length === length) {
      checked += 1;
      if (longest(prefix, true) < required && longest(prefix, false) < required) ok = false;
      return;
    }
    for (let value = 0; value < length; value += 1) {
      if ((unused & (1 << value)) !== 0) visit([...prefix, value], unused & ~(1 << value));
    }
  };
  visit([], 2 ** length - 1);
  return { ok, checked };
}

export function verify(): VerifyResult {
  let checked = 0;
  for (let n = 1; n <= 3; n += 1) {
    const result = checkPermutations(n * n + 1, n + 1);
    checked += result.checked;
    if (!result.ok)
      return { id: 'count-003', ok: false, details: `counterexample found at n=${n}` };
  }
  return {
    id: 'count-003',
    ok: true,
    details: `${checked} distinct-order sequences exhaustively checked for n=1..3`,
  };
}

if (process.argv[1]?.endsWith('count-003.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
