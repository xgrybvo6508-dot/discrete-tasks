# Review

Review the current changes (or the area named after the command) for correctness and design.

1. Run the **tester** subagent: add any missing tests for changed logic, then run typecheck, lint, tests and build.
2. Run the **ui-designer** subagent on changed UI/CSS/HTML. It checks against `30-design-system.mdc` and `00-user-context.mdc` (calm dark theme, green/purple meaning, one task in focus, AA contrast, keyboard, reduced motion, phone/iPad/desktop).
3. Fix the issues found, keeping edits small. Re-run the tester until everything is green.
4. Summarize in a few lines: what was checked, what was fixed, and anything still open that needs a decision from Vladislav.
