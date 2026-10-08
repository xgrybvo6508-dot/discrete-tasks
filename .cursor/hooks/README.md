# Project hooks

Configured in `.cursor/hooks.json`. Scripts run from the repo root, read JSON on stdin and write JSON on stdout. They need `bash` and `jq`, plus GNU `realpath` for the shell guard. All of them fail open (`failClosed: false`), but each one always prints valid JSON.

| Hook | Event | What it does |
|---|---|---|
| `guard-shell.sh` | `beforeShellExecution` | Returns `{"permission":"deny", user_message, agent_message}` for dangerous commands. Otherwise returns `{"permission":"allow"}`. |
| `guard-read.sh` | `beforeReadFile` | Blocks reading secret-looking files: `.env*` (except `.env.example/.sample/.template/.dist`), `*.pem`, `id_rsa*`/`id_ed25519*`/`id_ecdsa*`, `hosts.yml`, `auth.json`, `.netrc`. |
| `post-edit.sh` | `afterFileEdit` | Runs `node_modules/.bin/prettier --write` on edited `.ts/.css/.html/.json` files in `src/` or the repo root. Skips silently if prettier isn't installed, and never fails. |
| `secret-scan.sh` | `stop` (`loop_limit: 2`) | Scans changed, staged and untracked files for `sk-…`, `sk-or-…`, `gsk_…`, `ghp_/gho_/…`, `github_pat_…`, `AKIA…`, `Bearer <long token>` and private-key blocks. If it finds one, it returns `{"followup_message":"Secret-like string found in <file> (line N): remove it…"}`, otherwise `{}`. It reports line numbers only, never the value. Lines with `secret-scan:allow` are skipped, for deliberate fake test fixtures. |

## What `guard-shell.sh` blocks
- Recursive `rm` (`-r`, `-rf`, `-fr`, `--recursive`, also via `sudo`, `bash -c "..."`, `&&` chains) whose target is `/`, `~`, `$HOME`, `..`, a dot-glob, an unresolved `$VAR`, the project root, `.git`, or any path that resolves **outside the project**.
- `git push --force` / `-f` / `--force-with-lease` / `--force-if-includes` / `+refspec`.
- `git reset --hard` onto a remote ref (`origin/…`, `upstream/…`, any configured remote, `@{u}`, `refs/remotes/…`).
- Anything mentioning `.hermes`.
- Printing secrets: `printenv`, bare `env` / `env | …`, `export -p`/`declare -x`/bare `set`, `echo/printf $…KEY|TOKEN|SECRET|PASSW…`, `/proc/*/environ`, reading or copying `.env*` / `hosts.yml` / `auth.json` / keys, and `gh auth token`.
- `curl|wget … | sh/bash/zsh/python/node…`, `bash <(curl …)`, `source <(curl …)`.

## Testing
```bash
bash .cursor/hooks/test-hooks.sh
```
This pipes sample JSON into every script, covering more than 80 allow/deny/format/scan cases, and exits non-zero on any failure. You can also check a single command by hand, e.g. `echo '{"command":"git push -f"}' | .cursor/hooks/guard-shell.sh`.

To debug hooks inside Cursor, open Settings → Hooks or the **Hooks** output channel. Cursor reloads `hooks.json` when it is saved.
