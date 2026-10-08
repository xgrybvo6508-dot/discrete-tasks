export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

function binomial(n: number, k: number): number {
  let value = 1;
  for (let i = 1; i <= k; i += 1) value = (value * (n - k + i)) / i;
  return value;
}

export function verify(): VerifyResult {
  for (let n = 1; n <= 8; n += 1) {
    let count = 0;
    for (let mask = 0; mask < 2 ** (2 * n); mask += 1) {
      let height = 0;
      let primitive = true;
      for (let step = 0; step < 2 * n; step += 1) {
        height += (mask & (1 << step)) === 0 ? 1 : -1;
        if (height <= 0 && step < 2 * n - 1) primitive = false;
      }
      if (height === 0 && primitive) count += 1;
    }
    const canonical = binomial(2 * n - 2, n - 1) / n;
    if (count !== canonical)
      return { id: 'comb-001', ok: false, details: `n=${n}: ${count} != ${canonical}` };
  }
  return { id: 'comb-001', ok: true, details: 'primitive Dyck paths enumerated for n=1..8' };
}

if (process.argv[1]?.endsWith('comb-001.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
