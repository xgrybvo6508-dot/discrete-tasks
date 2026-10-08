# Ship

Prepare a release to GitHub Pages (`xgrybvo6508-dot/discrete-tasks`, Vite base `/discrete-tasks/`). Stop at the first red step and report it.

1. `npm run typecheck`
2. `npm test`
3. `npm run build`, then confirm that `dist/` asset URLs, `manifest.webmanifest` (`start_url`/`scope`) and the service worker all use `/discrete-tasks/`.
4. Secret scan: `bash .cursor/hooks/secret-scan.sh < /dev/null`. It must print `{}`. Also confirm `git ls-files` has no `.env*` file other than `.env.example`.
5. Only if **all** of the above are green, describe the deploy steps. Don't run them unless the user asks:
   - Commit with a clear message on `main`.
   - `git push origin main`. A normal push only: **never** `--force`, `-f`, `--force-with-lease`, or `+refspec`.
   - The GitHub Actions Pages workflow (`.github/workflows/deploy.yml`: checkout → `npm ci` → `npm run build` → upload `dist` → deploy-pages) publishes to `https://xgrybvo6508-dot.github.io/discrete-tasks/`.
   - After deploy, check that the site loads, works offline (reload with the network off), and can be installed as a PWA.

Report a short checklist with PASS/FAIL per step.
