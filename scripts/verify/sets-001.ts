export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export function verify(): VerifyResult {
  for (let n = 1; n <= 6; n += 1) {
    let count = 0;
    for (let encoding = 0; encoding < 8 ** n; encoding += 1) {
      let value = encoding;
      let valid = true;
      for (let element = 0; element < n; element += 1) {
        const membership = value % 8;
        if (membership === 0 || membership === 7) valid = false;
        value = Math.floor(value / 8);
      }
      if (valid) count += 1;
    }
    if (count !== 6 ** n)
      return { id: 'sets-001', ok: false, details: `n=${n}: ${count} != ${6 ** n}` };
  }
  return {
    id: 'sets-001',
    ok: true,
    details: 'all three-set membership patterns enumerated for n=1..6',
  };
}

if (process.argv[1]?.endsWith('sets-001.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
