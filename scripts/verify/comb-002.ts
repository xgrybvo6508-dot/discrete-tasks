export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

function countOddCompositions(remaining: number): number {
  if (remaining === 0) return 1;
  let count = 0;
  for (let part = 1; part <= remaining; part += 2) count += countOddCompositions(remaining - part);
  return count;
}

export function verify(): VerifyResult {
  const count = countOddCompositions(12);
  return {
    id: 'comb-002',
    ok: count === 144,
    details: `${count} odd-part compositions generated recursively`,
  };
}

if (process.argv[1]?.endsWith('comb-002.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
