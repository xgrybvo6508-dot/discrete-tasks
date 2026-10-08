#!/usr/bin/env bash
# stop hook: scan changed, staged and untracked (non-ignored) files for API-key-like strings.
# stdout: {} when clean, or {"followup_message": "Secret-like string found in <file>: remove it ..."}.
# A line containing the marker  secret-scan:allow  is ignored (for deliberate fake fixtures).
set -u

DONE=0
trap '[ "$DONE" = 1 ] || printf "{}\n"' EXIT

input=$(cat 2>/dev/null || true)
status="" root=""
if command -v jq >/dev/null 2>&1; then
  status=$(printf '%s' "$input" | jq -r '.status // ""' 2>/dev/null) || status=""
  root=$(printf '%s' "$input" | jq -r '.workspace_roots[0] // ""' 2>/dev/null) || root=""
fi
[ "$status" = "aborted" ] && exit 0
root=${root:-$PWD}
cd "$root" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

files=$({
  git diff --name-only
  git diff --cached --name-only
  git ls-files --others --exclude-standard
} 2>/dev/null | sort -u)

pattern='sk-[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|[Bb]earer[[:space:]]+[A-Za-z0-9._~+/=-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'

hits=""
while IFS= read -r f; do
  [ -n "$f" ] && [ -f "$f" ] || continue
  case "$f" in node_modules/* | dist/* | coverage/* | package-lock.json | *.lock) continue ;; esac
  size=$(wc -c <"$f" 2>/dev/null || echo 0)
  [ "$size" -le 1048576 ] || continue
  lines=$(grep -nIE -- "$pattern" "$f" 2>/dev/null | grep -v 'secret-scan:allow' | cut -d: -f1 | head -n 5 | paste -sd, -)
  [ -n "$lines" ] && hits="${hits:+$hits; }$f (line $lines)"
done <<<"$files"

[ -n "$hits" ] || exit 0

msg="Secret-like string found in $hits: remove it. API keys belong only in the app's Settings (localStorage), never in the repo. Do not print the value."
if command -v jq >/dev/null 2>&1; then
  jq -cn --arg m "$msg" '{followup_message:$m}'
else
  esc=${msg//\\/\\\\}
  printf '{"followup_message":"%s"}\n' "${esc//\"/\\\"}"
fi
DONE=1
