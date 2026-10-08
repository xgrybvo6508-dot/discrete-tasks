export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

function fibonacci(n: number): bigint {
  let previous = 0n;
  let current = 1n;
  for (let i = 0; i < n; i += 1) [previous, current] = [current, previous + current];
  return previous;
}

export function verify(): VerifyResult {
  for (let m = 1; m <= 12; m += 1) {
    for (let n = 0; n <= 12; n += 1) {
      const left = fibonacci(m + n);
      const right = fibonacci(m) * fibonacci(n + 1) + fibonacci(m - 1) * fibonacci(n);
      if (left !== right)
        return { id: 'ind-003', ok: false, details: `addition identity fails at m=${m}, n=${n}` };
    }
  }
  for (let n = 1; n <= 12; n += 1) {
    for (let k = 1; k <= 10; k += 1) {
      if (fibonacci(k * n) % fibonacci(n) !== 0n)
        return { id: 'ind-003', ok: false, details: `divisibility fails at n=${n}, k=${k}` };
    }
  }
  return {
    id: 'ind-003',
    ok: true,
    details: 'identity checked for m,n<=12; divisibility checked for n<=12, k<=10',
  };
}

if (process.argv[1]?.endsWith('ind-003.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
