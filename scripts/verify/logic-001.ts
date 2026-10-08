export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export function verify(): VerifyResult {
  let count = 0;
  for (let assignment = 0; assignment < 2 ** 10; assignment += 1) {
    let valid = true;
    for (let i = 0; i < 9; i += 1) {
      if ((assignment & (1 << i)) !== 0 && (assignment & (1 << (i + 1))) === 0) valid = false;
    }
    if (valid) count += 1;
  }
  return {
    id: 'logic-001',
    ok: count === 11,
    details: `${count} of 1024 truth assignments satisfy the chain`,
  };
}

if (process.argv[1]?.endsWith('logic-001.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
