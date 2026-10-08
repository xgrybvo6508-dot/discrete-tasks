export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

type Operation = (values: readonly number[]) => number;

function lift(operation: Operation, operands: readonly number[]): number {
  let table = 0;
  for (let input = 0; input < 4; input += 1) {
    const values = operands.map((operand) => (operand >> input) & 1);
    table |= operation(values) << input;
  }
  return table;
}

function closure(
  operations: readonly { arity: number; apply: Operation }[],
  constants: readonly number[],
): number {
  const functions = new Set<number>([0b1100, 0b1010, ...constants]);
  let changed = true;
  while (changed) {
    changed = false;
    const available = [...functions];
    for (const operation of operations) {
      const visit = (operands: number[]): void => {
        if (operands.length === operation.arity) {
          const result = lift(operation.apply, operands);
          if (!functions.has(result)) {
            functions.add(result);
            changed = true;
          }
          return;
        }
        for (const candidate of available) visit([...operands, candidate]);
      };
      visit([]);
    }
  }
  return functions.size;
}

export function verify(): VerifyResult {
  const not = { arity: 1, apply: (v: readonly number[]) => 1 - v[0]! };
  const and = { arity: 2, apply: (v: readonly number[]) => v[0]! & v[1]! };
  const or = { arity: 2, apply: (v: readonly number[]) => v[0]! | v[1]! };
  const implication = {
    arity: 2,
    apply: (v: readonly number[]) => (v[0] === 1 && v[1] === 0 ? 0 : 1),
  };
  const nand = { arity: 2, apply: (v: readonly number[]) => 1 - (v[0]! & v[1]!) };
  const xor = { arity: 2, apply: (v: readonly number[]) => v[0]! ^ v[1]! };
  const majority = {
    arity: 3,
    apply: (v: readonly number[]) => (v[0]! + v[1]! + v[2]! >= 2 ? 1 : 0),
  };
  const sizes = [
    closure([not, and], []),
    closure([implication], [0]),
    closure([nand], []),
    closure([and, or], []),
    closure([xor], [15]),
    closure([majority, not], []),
  ];
  const complete = sizes.flatMap((size, index) =>
    size === 16 ? [String.fromCharCode(65 + index)] : [],
  );
  return {
    id: 'bool-003',
    ok: complete.join(',') === 'A,B,C',
    details: `binary clone sizes ${sizes.join(', ')}; complete = {${complete.join(',')}}`,
  };
}

if (process.argv[1]?.endsWith('bool-003.ts')) {
  const result = verify();
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  if (!result.ok) process.exitCode = 1;
}
