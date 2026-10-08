export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export function verify(): VerifyResult {
  const matchedLeft = Array.from({ length: 101 }, () => 0);
  const augment = (right: number, seen: Set<number>): boolean => {
    for (let left = 1; left < right; left += 1) {
      if (right % left !== 0 || seen.has(left)) continue;
      seen.add(left);
      if (matchedLeft[left] === 0 || augment(matchedLeft[left]!, seen)) {
        matchedLeft[left] = right;
        return true;
      }
    }
    return false;
  };
  let matching = 0;
  for (let right = 1; right <= 100; right += 1) if (augment(right, new Set())) matching += 1;
  const width = 100 - matching;
  let upperHalfIsAntichain = true;
  for (let a = 51; a <= 100; a += 1) {
    for (let b = a + 1; b <= 100; b += 1) if (b % a === 0) upperHalfIsAntichain = false;
  }
  return {
    id: 'count-002',
    ok: width === 50 && upperHalfIsAntichain,
    details: `divisibility-poset width ${width} by exact matching; {51,...,100} checked as antichain`,
  };
}

if (process.argv[1]?.endsWith('count-002.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
