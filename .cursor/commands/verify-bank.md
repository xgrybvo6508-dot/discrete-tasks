# Verify the whole bank

1. Use the **solution-checker** subagent on **every** problem in `src/bank/`. It re-solves each one independently, makes sure each has a verifier in `scripts/verify/<id>.ts` (creating any that are missing), and fixes wrong answers, ambiguous statements or leaky hints.
2. Run `npm run verify` (all verifiers via `scripts/verify/run-all.ts`) and `npm test`.
3. Check coverage: every topic from `20-problem-quality.mdc` has at least 2 problems, difficulties 3–5 are represented, and ids are unique.
4. Report a compact table `id | topic | difficulty | answer type | result (PASS / FIXED / NEEDS HUMAN)`, then list the fixes and any coverage gaps.
