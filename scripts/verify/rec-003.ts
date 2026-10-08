export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export function verify(): VerifyResult {
  for (let n = 0; n <= 30; n += 1) {
    let count = 0;
    for (let apples = 0; apples <= n; apples += 2) {
      for (let bananas = 0; bananas <= n; bananas += 5) {
        for (let oranges = 0; oranges <= 4; oranges += 1) {
          for (let pears = 0; pears <= 1; pears += 1) {
            if (apples + bananas + oranges + pears === n) count += 1;
          }
        }
      }
    }
    if (count !== n + 1)
      return { id: 'rec-003', ok: false, details: `n=${n}: ${count} != ${n + 1}` };
  }
  return {
    id: 'rec-003',
    ok: true,
    details: 'all constrained count quadruples enumerated for n=0..30',
  };
}

if (process.argv[1]?.endsWith('rec-003.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
