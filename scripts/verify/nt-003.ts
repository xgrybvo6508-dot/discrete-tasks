export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function hasGenerator(n: number): boolean {
  const units = Array.from({ length: n }, (_, value) => value).filter(
    (value) => gcd(value, n) === 1,
  );
  return units.some((generator) => {
    const generated = new Set<number>();
    let value = 1 % n;
    for (let power = 0; power < units.length; power += 1) {
      generated.add(value);
      value = (value * generator) % n;
    }
    return generated.size === units.length;
  });
}

export function verify(): VerifyResult {
  const cyclic: number[] = [];
  for (let n = 1; n <= 30; n += 1) if (hasGenerator(n)) cyclic.push(n);
  const canonical = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 13, 14, 17, 18, 19, 22, 23, 25, 26, 27, 29];
  return {
    id: 'nt-003',
    ok: cyclic.join(',') === canonical.join(','),
    details: `generators tested directly; cyclic moduli = {${cyclic.join(',')}}`,
  };
}

if (process.argv[1]?.endsWith('nt-003.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
