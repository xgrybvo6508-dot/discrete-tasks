export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export function verify(): VerifyResult {
  for (let n = 1; n <= 4; n += 1) {
    let count = 0;
    for (let relation = 0; relation < 2 ** (n * n); relation += 1) {
      let everyRowHasWitness = true;
      for (let row = 0; row < n; row += 1) {
        let hasWitness = false;
        for (let column = 0; column < n; column += 1) {
          if ((relation & (1 << (row * n + column))) !== 0) hasWitness = true;
        }
        if (!hasWitness) everyRowHasWitness = false;
      }
      if (everyRowHasWitness) count += 1;
    }
    const canonical = (2 ** n - 1) ** n;
    if (count !== canonical)
      return { id: 'logic-002', ok: false, details: `n=${n}: ${count} != ${canonical}` };
  }
  return { id: 'logic-002', ok: true, details: 'all relations enumerated for domain sizes n=1..4' };
}

if (process.argv[1]?.endsWith('logic-002.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
