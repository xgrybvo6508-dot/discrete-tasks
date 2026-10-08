export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

function countExtensions(order: number[], unused: number): number {
  if (unused === 0) {
    const position = Array.from({ length: 8 }, () => 0);
    order.forEach((subset, index) => {
      position[subset] = index;
    });
    for (let x = 0; x < 8; x += 1) {
      for (let y = 0; y < 8; y += 1) {
        if (x !== y && (x & y) === x && position[x]! >= position[y]!) return 0;
      }
    }
    return 1;
  }
  let count = 0;
  for (let subset = 0; subset < 8; subset += 1) {
    if ((unused & (1 << subset)) !== 0)
      count += countExtensions([...order, subset], unused & ~(1 << subset));
  }
  return count;
}

export function verify(): VerifyResult {
  const count = countExtensions([], 2 ** 8 - 1);
  return {
    id: 'rel-003',
    ok: count === 48,
    details: `${count} of 8! subset orders respect strict inclusion`,
  };
}

if (process.argv[1]?.endsWith('rel-003.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
