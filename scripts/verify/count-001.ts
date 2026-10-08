export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

function countValid(prefix: number[], unused: number): number {
  if (unused === 0) return 1;
  let count = 0;
  for (let value = 1; value <= 6; value += 1) {
    if ((unused & (1 << (value - 1))) === 0) continue;
    const previous = prefix.at(-1);
    if (previous !== undefined && value === previous + 1) continue;
    count += countValid([...prefix, value], unused & ~(1 << (value - 1)));
  }
  return count;
}

export function verify(): VerifyResult {
  const count = countValid([], 2 ** 6 - 1);
  return {
    id: 'count-001',
    ok: count === 309,
    details: `${count} permutations generated without forbidden directed adjacency`,
  };
}

if (process.argv[1]?.endsWith('count-001.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
