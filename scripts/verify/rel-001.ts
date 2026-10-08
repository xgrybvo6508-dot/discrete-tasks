export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

function countPartitions(labels: number[], next: number, maximum: number): number {
  if (next === 6) {
    const sizes = Array.from({ length: maximum + 1 }, () => 0);
    for (const label of labels) sizes[label] = (sizes[label] ?? 0) + 1;
    return sizes.every((size) => size >= 2) ? 1 : 0;
  }
  let count = 0;
  for (let label = 0; label <= maximum + 1; label += 1) {
    count += countPartitions([...labels, label], next + 1, Math.max(maximum, label));
  }
  return count;
}

export function verify(): VerifyResult {
  const count = countPartitions([0], 1, 0);
  return {
    id: 'rel-001',
    ok: count === 41,
    details: `${count} restricted-growth partitions have no singleton block`,
  };
}

if (process.argv[1]?.endsWith('rel-001.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
