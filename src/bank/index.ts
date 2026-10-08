import { BOOLEAN_PROBLEMS } from './problems/boolean';
import { COMBINATORICS_PROBLEMS } from './problems/combinatorics';
import { COUNTING_PRINCIPLES_PROBLEMS } from './problems/counting-principles';
import { GRAPH_PROBLEMS } from './problems/graphs';
import { INDUCTION_PROBLEMS } from './problems/induction';
import { LOGIC_PROBLEMS } from './problems/logic';
import { NUMBER_THEORY_PROBLEMS } from './problems/number-theory';
import { RECURRENCES_PROBLEMS } from './problems/recurrences';
import { RELATIONS_PROBLEMS } from './problems/relations';
import { SETS_PROBLEMS } from './problems/sets';
import type { Problem } from './types';

export const BANK = [
  ...COMBINATORICS_PROBLEMS,
  ...GRAPH_PROBLEMS,
  ...LOGIC_PROBLEMS,
  ...SETS_PROBLEMS,
  ...RELATIONS_PROBLEMS,
  ...INDUCTION_PROBLEMS,
  ...RECURRENCES_PROBLEMS,
  ...BOOLEAN_PROBLEMS,
  ...NUMBER_THEORY_PROBLEMS,
  ...COUNTING_PRINCIPLES_PROBLEMS,
] satisfies readonly Problem[];

export const byId: ReadonlyMap<string, Problem> = new Map(
  BANK.map((problem) => [problem.id, problem]),
);
