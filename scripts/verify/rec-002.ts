export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

function countTilings(n: number): number {
  const full = 2 ** (2 * n) - 1;
  const memo = new Map<number, number>();
  const search = (occupied: number): number => {
    if (occupied === full) return 1;
    const cached = memo.get(occupied);
    if (cached !== undefined) return cached;
    let first = 0;
    while ((occupied & (1 << first)) !== 0) first += 1;
    const column = first % n;
    const placements: number[] = [];
    const vertical = (1 << column) | (1 << (n + column));
    placements.push(vertical);
    if (column + 1 < n) {
      placements.push((1 << first) | (1 << (first + 1)));
      const square = vertical | (1 << (column + 1)) | (1 << (n + column + 1));
      placements.push(square);
    }
    let total = 0;
    for (const placement of placements) {
      if ((placement & (1 << first)) !== 0 && (placement & occupied) === 0)
        total += search(occupied | placement);
    }
    memo.set(occupied, total);
    return total;
  };
  if (n === 0) return 1;
  return search(0);
}

export function verify(): VerifyResult {
  for (let n = 0; n <= 10; n += 1) {
    const direct = countTilings(n);
    const canonical = (2 ** (n + 1) + (-1) ** n) / 3;
    if (direct !== canonical)
      return { id: 'rec-002', ok: false, details: `n=${n}: ${direct} != ${canonical}` };
  }
  return { id: 'rec-002', ok: true, details: 'exact-cover tilings enumerated for n=0..10' };
}

if (process.argv[1]?.endsWith('rec-002.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
