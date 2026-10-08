# Add a problem

Add one new university-level problem to the built-in bank on the topic (and optional difficulty or idea) given after the command. If no topic is given, choose the topic with the fewest problems.

1. Use the **task-author** subagent to write the problem in the bank's TypeScript `Problem` format, following `.cursor/rules/20-problem-quality.mdc`: precise statement, 3–4 progressive hints, full solution, an auto-checkable answer where possible, and `related` links.
2. Then use the **solution-checker** subagent on the new id. It re-solves the problem independently, writes `scripts/verify/<id>.ts`, runs it, and fixes any mismatch.
3. Run `npm run typecheck` and `npm test` if the project is set up.
4. Reply briefly with the id, title, topic, difficulty, answer type and canonical answer, and the verification result.
