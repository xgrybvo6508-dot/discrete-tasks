export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

function binomial(n: number, k: number): number {
  if (k > n) return 0;
  let value = 1;
  for (let i = 1; i <= k; i += 1) value = (value * (n - k + i)) / i;
  return value;
}

function alternates(a: number, b: number, c: number, d: number): boolean {
  const between = (x: number): boolean => (a < b ? a < x && x < b : x > a || x < b);
  return between(c) !== between(d);
}

export function verify(): VerifyResult {
  for (let n = 1; n <= 10; n += 1) {
    const chords: Array<readonly [number, number]> = [];
    for (let a = 0; a < n; a += 1) for (let b = a + 1; b < n; b += 1) chords.push([a, b]);
    let crossings = 0;
    for (let i = 0; i < chords.length; i += 1) {
      for (let j = i + 1; j < chords.length; j += 1) {
        const [a, b] = chords[i]!;
        const [c, d] = chords[j]!;
        if (new Set([a, b, c, d]).size === 4 && alternates(a, b, c, d)) crossings += 1;
      }
    }
    const regions = 1 + chords.length + crossings;
    const canonical = 1 + binomial(n, 2) + binomial(n, 4);
    if (regions !== canonical)
      return { id: 'ind-002', ok: false, details: `n=${n}: ${regions} != ${canonical}` };
  }
  return { id: 'ind-002', ok: true, details: 'chords and crossing pairs enumerated for n=1..10' };
}

if (process.argv[1]?.endsWith('ind-002.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
