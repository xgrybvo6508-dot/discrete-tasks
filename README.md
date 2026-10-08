# Discrete Tasks

Discrete Tasks is a calm, offline-first study app for university discrete mathematics. It shows one problem at a time, gives progressive hints, checks structured answers locally, and uses spaced repetition with topic interleaving. An optional OpenAI-compatible agent can generate problems and respond to written work.

## Run locally

Requires Node.js 20 or newer.

```sh
npm ci
npm run dev
```

Useful checks:

```sh
npm run typecheck
npm run lint
npm test
npm run verify
npm run build
npm run e2e
```

The production build uses the GitHub Pages base path `/discrete-tasks/`. `vite-plugin-pwa` precaches the app, verified bank, KaTeX, and local fonts for offline use.

## Privacy

Practice memory and settings stay on the device. There is no telemetry. If an API key is added in Settings, it is stored only in localStorage and is sent only to the provider URL chosen by the user. Memory exports never contain settings or API keys.

The Content Security Policy permits `connect-src https:` because the provider origin is chosen at runtime. No third-party scripts, fonts, or trackers are loaded.

## Cursor tooling

The repository includes Cursor rules for product, code, design, problem quality, and security conventions. Hooks guard dangerous commands, format edits, and scan changes for secrets. Focused subagents review problem solutions, tests, and UI design. Commands such as `/verify-bank`, `/review`, and `/ship` define repeatable release checks.

GitHub Actions builds and deploys `dist/` to GitHub Pages after a push to `main`. Deployment is intentionally not performed by the app or its local tooling.
