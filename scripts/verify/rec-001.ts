export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export function verify(): VerifyResult {
  for (let n = 0; n <= 10; n += 1) {
    let even = 0;
    for (let word = 0; word < 3 ** n; word += 1) {
      let value = word;
      let aCount = 0;
      for (let position = 0; position < n; position += 1) {
        if (value % 3 === 0) aCount += 1;
        value = Math.floor(value / 3);
      }
      if (aCount % 2 === 0) even += 1;
    }
    const canonical = (3 ** n + 1) / 2;
    if (even !== canonical)
      return { id: 'rec-001', ok: false, details: `n=${n}: ${even} != ${canonical}` };
  }
  return { id: 'rec-001', ok: true, details: 'all ternary strings enumerated for n=0..10' };
}

if (process.argv[1]?.endsWith('rec-001.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
