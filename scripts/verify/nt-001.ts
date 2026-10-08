export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export function verify(): VerifyResult {
  const roots: number[] = [];
  for (let x = 0; x < 1000; x += 1) if ((x * x) % 1000 === 1) roots.push(x);
  return {
    id: 'nt-001',
    ok: roots.length === 8,
    details: `${roots.length} residues found: ${roots.join(', ')}`,
  };
}

if (process.argv[1]?.endsWith('nt-001.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
