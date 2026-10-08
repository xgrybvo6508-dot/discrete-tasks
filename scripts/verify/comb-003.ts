export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

function binomial(n: number, k: number): number {
  let count = 0;
  for (let mask = 0; mask < 2 ** n; mask += 1) {
    let size = 0;
    for (let bit = 0; bit < n; bit += 1) size += (mask >> bit) & 1;
    if (size === k) count += 1;
  }
  return count;
}

export function verify(): VerifyResult {
  for (let n = 1; n <= 8; n += 1) {
    let direct = 0;
    for (let left = 0; left < 2 ** n; left += 1) {
      let k = 0;
      for (let bit = 0; bit < n; bit += 1) k += (left >> bit) & 1;
      direct += k * binomial(n, k);
    }
    const canonical = n * binomial(2 * n - 1, n - 1);
    if (direct !== canonical)
      return { id: 'comb-003', ok: false, details: `n=${n}: ${direct} != ${canonical}` };
  }
  return { id: 'comb-003', ok: true, details: 'subset pairs and chairs enumerated for n=1..8' };
}

if (process.argv[1]?.endsWith('comb-003.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
