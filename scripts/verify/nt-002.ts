export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export function verify(): VerifyResult {
  let residue = 1;
  for (let exponent = 0; exponent < 2026; exponent += 1) residue = (residue * 7) % 100;
  return {
    id: 'nt-002',
    ok: residue === 49,
    details: `direct modular multiplication gives ${residue}`,
  };
}

if (process.argv[1]?.endsWith('nt-002.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
