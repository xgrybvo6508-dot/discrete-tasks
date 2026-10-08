#!/usr/bin/env bash
# afterFileEdit hook: run the project's local prettier on edited .ts/.css/.html/.json
# files under src/ or at the repo root. Silently skips if prettier isn't installed. Never fails.
# stdin: {"file_path": "...", "edits": [...], "workspace_roots": [...], ...}
set -u
trap 'printf "{}\n"; exit 0' EXIT

input=$(cat 2>/dev/null || true)
command -v jq >/dev/null 2>&1 || exit 0
file=$(printf '%s' "$input" | jq -r '.file_path // ""' 2>/dev/null) || exit 0
root=$(printf '%s' "$input" | jq -r '.workspace_roots[0] // ""' 2>/dev/null) || root=""
root=${root:-$PWD}
[ -n "$file" ] || exit 0

case "$file" in
  /*) abs=$file ;;
  *) abs="$root/$file" ;;
esac
rel=${abs#"$root"/}
[ "$rel" != "$abs" ] || exit 0 # outside the project
[ -f "$abs" ] || exit 0

case "$rel" in *.ts | *.css | *.html | *.json) ;; *) exit 0 ;; esac
case "$rel" in package-lock.json) exit 0 ;; src/*) ;; */*) exit 0 ;; esac

prettier="$root/node_modules/.bin/prettier"
[ -x "$prettier" ] || exit 0

if command -v timeout >/dev/null 2>&1; then
  (cd "$root" && timeout 20 "$prettier" --write "$rel") >/dev/null 2>&1 || true
else
  (cd "$root" && "$prettier" --write "$rel") >/dev/null 2>&1 || true
fi
