export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

function isTree(n: number, mask: number): boolean {
  if (mask.toString(2).replaceAll('0', '').length !== n + 1) return false;
  const seen = new Set<number>([0]);
  const queue = [0];
  while (queue.length > 0) {
    const vertex = queue.shift();
    if (vertex === undefined) break;
    for (let edge = 0; edge < 2 * n; edge += 1) {
      if ((mask & (1 << edge)) === 0) continue;
      const endpoint = edge < n ? 0 : 1;
      const other = 2 + (edge % n);
      const next = vertex === endpoint ? other : vertex === other ? endpoint : -1;
      if (next >= 0 && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === n + 2;
}

export function verify(): VerifyResult {
  for (let n = 1; n <= 5; n += 1) {
    let count = 0;
    for (let mask = 0; mask < 2 ** (2 * n); mask += 1) if (isTree(n, mask)) count += 1;
    const canonical = n * 2 ** (n - 1);
    if (count !== canonical)
      return { id: 'graph-002', ok: false, details: `n=${n}: ${count} != ${canonical}` };
  }
  return { id: 'graph-002', ok: true, details: 'all edge subsets checked for K_{2,n}, n=1..5' };
}

if (process.argv[1]?.endsWith('graph-002.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
