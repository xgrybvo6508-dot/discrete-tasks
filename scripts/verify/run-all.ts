import { verify as verifyBool001 } from './bool-001';
import { verify as verifyBool002 } from './bool-002';
import { verify as verifyBool003 } from './bool-003';
import { verify as verifyComb001 } from './comb-001';
import { verify as verifyComb002 } from './comb-002';
import { verify as verifyComb003 } from './comb-003';
import { verify as verifyCount001 } from './count-001';
import { verify as verifyCount002 } from './count-002';
import { verify as verifyCount003 } from './count-003';
import { verify as verifyGraph001 } from './graph-001';
import { verify as verifyGraph002 } from './graph-002';
import { verify as verifyGraph003 } from './graph-003';
import { verify as verifyInd001 } from './ind-001';
import { verify as verifyInd002 } from './ind-002';
import { verify as verifyInd003 } from './ind-003';
import { verify as verifyLogic001 } from './logic-001';
import { verify as verifyLogic002 } from './logic-002';
import { verify as verifyLogic003 } from './logic-003';
import { verify as verifyNt001 } from './nt-001';
import { verify as verifyNt002 } from './nt-002';
import { verify as verifyNt003 } from './nt-003';
import { verify as verifyRec001 } from './rec-001';
import { verify as verifyRec002 } from './rec-002';
import { verify as verifyRec003 } from './rec-003';
import { verify as verifyRel001 } from './rel-001';
import { verify as verifyRel002 } from './rel-002';
import { verify as verifyRel003 } from './rel-003';
import { verify as verifySets001 } from './sets-001';
import { verify as verifySets002 } from './sets-002';
import { verify as verifySets003 } from './sets-003';

export interface VerifyResult {
  id: string;
  ok: boolean;
  details: string;
}

export type Verifier = () => VerifyResult;

const VERIFIERS: readonly Verifier[] = [
  verifyComb001,
  verifyComb002,
  verifyComb003,
  verifyGraph001,
  verifyGraph002,
  verifyGraph003,
  verifyLogic001,
  verifyLogic002,
  verifyLogic003,
  verifySets001,
  verifySets002,
  verifySets003,
  verifyRel001,
  verifyRel002,
  verifyRel003,
  verifyInd001,
  verifyInd002,
  verifyInd003,
  verifyRec001,
  verifyRec002,
  verifyRec003,
  verifyBool001,
  verifyBool002,
  verifyBool003,
  verifyNt001,
  verifyNt002,
  verifyNt003,
  verifyCount001,
  verifyCount002,
  verifyCount003,
];

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
