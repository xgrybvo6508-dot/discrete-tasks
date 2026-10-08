export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export function verify(): VerifyResult {
  const seen = new Set<number>();
  for (let subset = 0; subset < 2 ** 10; subset += 1) {
    let encoding = 0;
    for (let bit = 0; bit < 10; bit += 1) if ((subset & (1 << bit)) !== 0) encoding += 2 ** bit;
    if (seen.has(encoding))
      return { id: 'sets-003', ok: false, details: 'binary encoding collision' };
    seen.add(encoding);
  }

  for (let m = 1; m <= 3; m += 1) {
    for (let listCode = 0; listCode < (2 ** m) ** m; listCode += 1) {
      let value = listCode;
      const list: number[] = [];
      let diagonal = 0;
      for (let index = 0; index < m; index += 1) {
        const subset = value % 2 ** m;
        list.push(subset);
        if ((subset & (1 << index)) === 0) diagonal |= 1 << index;
        value = Math.floor(value / 2 ** m);
      }
      for (let index = 0; index < m; index += 1) {
        if (diagonal === list[index])
          return { id: 'sets-003', ok: false, details: `diagonal appeared at m=${m}` };
      }
    }
  }
  return {
    id: 'sets-003',
    ok: true,
    details:
      'binary encoding checked on 1024 subsets; all finite lists checked for diagonal escape at m=1..3',
  };
}

if (process.argv[1]?.endsWith('sets-003.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
