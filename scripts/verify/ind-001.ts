export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

type Cell = readonly [number, number];
type Tromino = readonly [Cell, Cell, Cell];

function tile(size: number, originX: number, originY: number, missing: Cell): Tromino[] {
  if (size === 2) {
    const cells: Cell[] = [];
    for (let y = originY; y < originY + 2; y += 1) {
      for (let x = originX; x < originX + 2; x += 1) {
        if (x !== missing[0] || y !== missing[1]) cells.push([x, y]);
      }
    }
    return [cells as unknown as Tromino];
  }
  const half = size / 2;
  const missingQuadrant =
    (missing[0] >= originX + half ? 1 : 0) + (missing[1] >= originY + half ? 2 : 0);
  const centres: Cell[] = [
    [originX + half - 1, originY + half - 1],
    [originX + half, originY + half - 1],
    [originX + half - 1, originY + half],
    [originX + half, originY + half],
  ];
  const central = centres.filter(
    (_, quadrant) => quadrant !== missingQuadrant,
  ) as unknown as Tromino;
  const result: Tromino[] = [central];
  for (let quadrant = 0; quadrant < 4; quadrant += 1) {
    const qx = quadrant % 2;
    const qy = Math.floor(quadrant / 2);
    result.push(
      ...tile(
        half,
        originX + qx * half,
        originY + qy * half,
        quadrant === missingQuadrant ? missing : centres[quadrant]!,
      ),
    );
  }
  return result;
}

export function verify(): VerifyResult {
  let boards = 0;
  for (let n = 1; n <= 4; n += 1) {
    const size = 2 ** n;
    for (let missingY = 0; missingY < size; missingY += 1) {
      for (let missingX = 0; missingX < size; missingX += 1) {
        boards += 1;
        const counts = new Map<string, number>();
        for (const tromino of tile(size, 0, 0, [missingX, missingY])) {
          const xs = tromino.map(([x]) => x);
          const ys = tromino.map(([, y]) => y);
          if (
            new Set(tromino.map(([x, y]) => `${x},${y}`)).size !== 3 ||
            Math.max(...xs) - Math.min(...xs) !== 1 ||
            Math.max(...ys) - Math.min(...ys) !== 1
          ) {
            return { id: 'ind-001', ok: false, details: `invalid tromino on ${size}x${size}` };
          }
          for (const [x, y] of tromino) counts.set(`${x},${y}`, (counts.get(`${x},${y}`) ?? 0) + 1);
        }
        for (let y = 0; y < size; y += 1) {
          for (let x = 0; x < size; x += 1) {
            const expected = x === missingX && y === missingY ? 0 : 1;
            if ((counts.get(`${x},${y}`) ?? 0) !== expected)
              return { id: 'ind-001', ok: false, details: `coverage failure on ${size}x${size}` };
          }
        }
      }
    }
  }
  return {
    id: 'ind-001',
    ok: true,
    details: `recursive tilings validated for all ${boards} missing cells at n=1..4`,
  };
}

if (process.argv[1]?.endsWith('ind-001.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
