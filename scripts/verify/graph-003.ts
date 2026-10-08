export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

function edgeIndex(n: number, a: number, b: number): number {
  let index = 0;
  for (let i = 0; i < a; i += 1) index += n - i - 1;
  return index + b - a - 1;
}

function hasEdge(n: number, tournament: number, from: number, to: number): boolean {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const lowToHigh = (tournament & (1 << edgeIndex(n, low, high))) !== 0;
  return from === low ? lowToHigh : !lowToHigh;
}

function hasHamiltonianPath(n: number, tournament: number): boolean {
  const search = (path: number[], unused: number): boolean => {
    if (unused === 0) return true;
    for (let next = 0; next < n; next += 1) {
      if ((unused & (1 << next)) === 0) continue;
      const last = path.at(-1);
      if (last === undefined || hasEdge(n, tournament, last, next)) {
        if (search([...path, next], unused & ~(1 << next))) return true;
      }
    }
    return false;
  };
  return search([], (1 << n) - 1);
}

export function verify(): VerifyResult {
  let checked = 0;
  for (let n = 1; n <= 5; n += 1) {
    for (let tournament = 0; tournament < 2 ** ((n * (n - 1)) / 2); tournament += 1) {
      checked += 1;
      if (!hasHamiltonianPath(n, tournament)) {
        return {
          id: 'graph-003',
          ok: false,
          details: `counterexample at n=${n}, encoding=${tournament}`,
        };
      }
    }
  }
  return {
    id: 'graph-003',
    ok: true,
    details: `${checked} tournaments exhaustively checked for n=1..5`,
  };
}

if (process.argv[1]?.endsWith('graph-003.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
