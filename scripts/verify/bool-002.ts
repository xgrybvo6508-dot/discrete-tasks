export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export function verify(): VerifyResult {
  let count = 0;
  for (let table = 0; table < 2 ** 16; table += 1) {
    let monotone = true;
    for (let x = 0; x < 16; x += 1) {
      for (let y = 0; y < 16; y += 1) {
        if ((x & y) === x && ((table >> x) & 1) > ((table >> y) & 1)) monotone = false;
      }
    }
    if (monotone) count += 1;
  }
  return {
    id: 'bool-002',
    ok: count === 168,
    details: `${count} of 65536 truth tables are monotone`,
  };
}

if (process.argv[1]?.endsWith('bool-002.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
