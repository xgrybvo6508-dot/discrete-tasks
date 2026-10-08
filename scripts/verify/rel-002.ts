export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export function verify(): VerifyResult {
  let count = 0;
  for (let code = 0; code < 3 ** 6; code += 1) {
    const relation = Array.from({ length: 4 }, (_, i) =>
      Array.from({ length: 4 }, (_, j) => i === j),
    );
    let value = code;
    for (let i = 0; i < 4; i += 1) {
      for (let j = i + 1; j < 4; j += 1) {
        const direction = value % 3;
        if (direction === 1) relation[i]![j] = true;
        if (direction === 2) relation[j]![i] = true;
        value = Math.floor(value / 3);
      }
    }
    let transitive = true;
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        for (let k = 0; k < 4; k += 1) {
          if (relation[i]![j] && relation[j]![k] && !relation[i]![k]) transitive = false;
        }
      }
    }
    if (transitive) count += 1;
  }
  return {
    id: 'rel-002',
    ok: count === 219,
    details: `${count} reflexive antisymmetric relation encodings are transitive`,
  };
}

if (process.argv[1]?.endsWith('rel-002.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
