# AGENTS.md: Discrete Tasks

**Discrete Tasks** is a static PWA that serves university-level discrete-math problems. It has an in-app AI agent that generates problems, gives step-by-step hints and checks answers through an OpenAI-compatible API. The user sets the base URL, key and model in Settings, and the key is stored only in localStorage. A local memory of solved problems, mistakes, topics and timing drives interleaving and spaced repetition. An offline bank of ~30 verified problems is included, and KaTeX renders the math. It deploys to GitHub Pages (`xgrybvo6508-dot/discrete-tasks`, Vite `base: '/discrete-tasks/'`).

**User:** Vladislav, 18, university student; autism spectrum + ADHD, twice-exceptional. He learns through mind maps and interleaving and loves minimalism. **The UI is in English.** Design: dark, calm, minimalist, green (primary/success) and purple (agent/hints) accents, one task in focus, no flashing.

## Rules (`.cursor/rules/`)
| file | applies | about |
|---|---|---|
| `00-user-context.mdc` | always | who the user is → focus, low cognitive load, predictable UI, pedagogy |
| `10-project-conventions.mdc` | always | Vite + vanilla strict TS, folder layout, vitest, npm scripts, base path |
| `20-problem-quality.mdc` | `src/bank/**`, `src/agent/**` | university level, topics, `Problem` format, mandatory verification |
| `30-design-system.mdc` | `src/ui/**`, `src/**/*.css`, `index.html` | tokens, typography, motion, a11y, responsive |
| `40-security-secrets.mdc` | always | keys only in localStorage, no secrets in repo/logs, CORS errors, no telemetry |

## Layout
`src/agent` (API client, prompts, JSON validation) · `src/memory` (storage, SRS, interleaving) · `src/bank` (types + offline problems) · `src/ui` (views, CSS) · `src/lib` (pure helpers, answer checking) · `scripts/verify` (brute-force answer checks).

## Commands
`npm run dev | build | preview | test | lint | typecheck | verify | format`. Done means: typecheck, lint, test and build are green (and `verify` too if the bank changed).

## Subagents (`.cursor/agents/`)
- **task-author**: writes new bank problems in the TS format.
- **solution-checker**: independently re-solves and brute-forces answers (`scripts/verify/`), fixes mismatches. Use proactively after bank changes.
- **ui-designer**: enforces the design system on CSS/layout.
- **tester**: vitest for memory, answer checking and agent parsing, plus build. Use proactively after code changes.

## Slash commands (`.cursor/commands/`)
`/add-problem <topic>` · `/verify-bank` · `/review` · `/ship` (checks only, then describes the deploy; never force-push).

## Hooks (`.cursor/hooks.json`, details in `.cursor/hooks/README.md`)
- `guard-shell.sh` blocks dangerous shell commands: rm -r outside the project, force-push, reset --hard to remote, `~/.hermes`, printing secrets, curl|sh.
- `guard-read.sh` blocks reading secret files.
- `post-edit.sh` runs prettier on edited files.
- `secret-scan.sh` (on stop) flags API-key-like strings in changed files.
- Self-test: `bash .cursor/hooks/test-hooks.sh`.

## Hard limits
Never commit or print secrets. Never force-push. Never touch `~/.hermes` or anything outside this repo. No telemetry or third-party CDNs.
