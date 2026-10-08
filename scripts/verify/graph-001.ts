export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export function verify(): VerifyResult {
  let leaves = 0;
  for (let code = 0; code < 7 ** 5; code += 1) {
    let value = code;
    let containsOne = false;
    for (let position = 0; position < 5; position += 1) {
      if (value % 7 === 0) containsOne = true;
      value = Math.floor(value / 7);
    }
    if (!containsOne) leaves += 1;
  }
  return { id: 'graph-001', ok: leaves === 7776, details: `${leaves} Prüfer codes omit vertex 1` };
}

if (process.argv[1]?.endsWith('graph-001.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
