export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export type Verifier = () => VerifyResult;

// Verifiers are added per bank problem in phase P2.
const VERIFIERS: readonly Verifier[] = [];

function main(): void {
  let failed = 0;
  for (const verify of VERIFIERS) {
    const result = verify();
    if (!result.ok) failed += 1;
    console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id}  ${result.details}`);
  }
  console.log(`\n${VERIFIERS.length - failed}/${VERIFIERS.length} passed`);
  if (failed > 0) process.exitCode = 1;
}

main();
