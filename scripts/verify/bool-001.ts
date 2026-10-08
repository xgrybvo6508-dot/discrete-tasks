export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export function verify(): VerifyResult {
  for (let n = 1; n <= 4; n += 1) {
    const inputs = 2 ** n;
    const inputMask = inputs - 1;
    let count = 0;
    for (let table = 0; table < 2 ** inputs; table += 1) {
      let selfDual = true;
      for (let input = 0; input < inputs; input += 1) {
        const value = (table >> input) & 1;
        const complementValue = (table >> (input ^ inputMask)) & 1;
        if (complementValue !== 1 - value) selfDual = false;
      }
      if (selfDual) count += 1;
    }
    const canonical = 2 ** (2 ** (n - 1));
    if (count !== canonical)
      return { id: 'bool-001', ok: false, details: `n=${n}: ${count} != ${canonical}` };
  }
  return { id: 'bool-001', ok: true, details: 'all Boolean function tables enumerated for n=1..4' };
}

if (process.argv[1]?.endsWith('bool-001.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
