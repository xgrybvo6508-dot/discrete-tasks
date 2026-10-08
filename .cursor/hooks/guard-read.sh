#!/usr/bin/env bash
# beforeReadFile hook: deny reading files that look like secrets.
# stdin:  {"file_path": "...", "content": "...", ...}
# stdout: {"permission":"allow"} or {"permission":"deny","user_message":"..."}
set -u

DONE=0
trap '[ "$DONE" = 1 ] || printf "%s\n" "{\"permission\":\"allow\"}"' EXIT

input=$(cat 2>/dev/null || true)
file=""
if command -v jq >/dev/null 2>&1; then
  file=$(printf '%s' "$input" | jq -r '.file_path // ""' 2>/dev/null) || file=""
fi
if [ -z "$file" ]; then
  file=$(printf '%s' "$input" | sed -nE 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/p' | head -n1)
fi

base=${file##*/}
secret=0
case "$base" in
  .env.example | .env.sample | .env.template | .env.dist) ;;
  .env | .env.* | *.pem | id_rsa* | id_ed25519* | id_ecdsa* | hosts.yml | auth.json | .netrc) secret=1 ;;
esac

if [ "$secret" = 1 ]; then
  printf '%s\n' "{\"permission\":\"deny\",\"user_message\":\"Blocked by project hook: '${base//[\"\\]/}' looks like a secrets file and must not be read by the agent.\"}"
else
  printf '%s\n' '{"permission":"allow"}'
fi
DONE=1
