export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export function verify(): VerifyResult {
  const possible: number[] = [];
  for (let n = 1; n <= 12; n += 1) {
    const total = (n * (n + 1)) / 2;
    let found = false;
    for (let a = 0; a < 2 ** n; a += 1) {
      let size = 0;
      let sum = 0;
      for (let value = 1; value <= n; value += 1) {
        if ((a & (1 << (value - 1))) !== 0) {
          size += 1;
          sum += value;
        }
      }
      if (size * 2 === n && sum * 2 === total) found = true;
    }
    if (found) possible.push(n);
  }
  return {
    id: 'sets-002',
    ok: possible.join(',') === '4,8,12',
    details: `exhaustive set = {${possible.join(',')}}`,
  };
}

if (process.argv[1]?.endsWith('sets-002.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
