export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export function verify(): VerifyResult {
  const valid = [true, true, true, true, true, true];
  for (let n = 1; n <= 2; n += 1) {
    for (let p = 0; p < 2 ** n; p += 1) {
      for (let q = 0; q < 2 ** n; q += 1) {
        for (let relation = 0; relation < 2 ** (n * n); relation += 1) {
          const everyP = p === 2 ** n - 1;
          const everyQ = q === 2 ** n - 1;
          const someP = p !== 0;
          const someQ = q !== 0;
          const formulas = [
            ((p & q) === 2 ** n - 1) === (everyP && everyQ),
            ((p | q) !== 0) === (someP || someQ),
            ((p | q) === 2 ** n - 1) === (everyP || everyQ),
            ((p & q) !== 0) === (someP && someQ),
            !everyP === ((~p & (2 ** n - 1)) !== 0),
            false,
          ];
          let everyRow = true;
          for (let x = 0; x < n; x += 1) {
            let someY = false;
            for (let y = 0; y < n; y += 1) someY ||= (relation & (1 << (x * n + y))) !== 0;
            everyRow &&= someY;
          }
          let commonColumn = false;
          for (let y = 0; y < n; y += 1) {
            let allX = true;
            for (let x = 0; x < n; x += 1) allX &&= (relation & (1 << (x * n + y))) !== 0;
            commonColumn ||= allX;
          }
          formulas[5] = !everyRow || commonColumn;
          for (let i = 0; i < formulas.length; i += 1) valid[i] &&= formulas[i] ?? false;
        }
      }
    }
  }
  const labels = valid.flatMap((isValid, index) =>
    isValid ? [String.fromCharCode(65 + index)] : [],
  );
  const ok = labels.join(',') === 'A,B,E';
  return { id: 'logic-003', ok, details: `bounded exhaustive valid set = {${labels.join(',')}}` };
}

if (process.argv[1]?.endsWith('logic-003.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
