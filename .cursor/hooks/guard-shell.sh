#!/usr/bin/env bash
# beforeShellExecution hook: deny dangerous shell commands.
# stdin:  {"command": "...", "cwd": "...", "workspace_roots": [...], ...}
# stdout: exactly one JSON object: {"permission":"allow"} or a deny object.
set -u
set -f # never glob-expand while tokenising

DONE=0
emit() {
  printf '%s\n' "$1"
  DONE=1
}
trap '[ "$DONE" = 1 ] || printf "%s\n" "{\"permission\":\"allow\"}"' EXIT

input=$(cat 2>/dev/null || true)
HAVE_JQ=0
command -v jq >/dev/null 2>&1 && HAVE_JQ=1

cmd="" root="" cwd=""
if [ "$HAVE_JQ" = 1 ] && printf '%s' "$input" | jq -e 'type == "object"' >/dev/null 2>&1; then
  cmd=$(printf '%s' "$input" | jq -r '.command // ""')
  root=$(printf '%s' "$input" | jq -r '.workspace_roots[0] // ""')
  cwd=$(printf '%s' "$input" | jq -r '.cwd // ""')
else
  cmd=$input # unparseable input: still scan the raw text
fi
root=${root:-$PWD}
cwd=${cwd:-$root}
HOME_DIR=${HOME:-/nonexistent-home}

resolve() { realpath -m -- "$1" 2>/dev/null || printf '%s' "$1"; }
ROOT_R=$(resolve "$root")

deny() {
  local um="Blocked by project hook: $1."
  local am="The guard-shell hook blocked this command ($1). Do not retry or work around it; use a safe alternative or ask the user."
  if [ "$HAVE_JQ" = 1 ]; then
    emit "$(jq -cn --arg u "$um" --arg a "$am" '{permission:"deny",user_message:$u,agent_message:$a}')"
  else
    emit "{\"permission\":\"deny\",\"user_message\":\"${um//\"/}\",\"agent_message\":\"${am//\"/}\"}"
  fi
  exit 0
}

is_secret_file() {
  local b=${1##*/}
  b=${b#<}
  case "$b" in
    .env.example | .env.sample | .env.template | .env.dist) return 1 ;;
    .env | .env.* | *.pem | id_rsa* | id_ed25519* | id_ecdsa* | hosts.yml | auth.json | .netrc) return 0 ;;
    environ) [[ $1 == /proc/* ]] && return 0 ;;
  esac
  return 1
}

check_rm_target() {
  local p=$1 r
  [ -n "$p" ] || return 0
  case "$p" in
    '~' | '~/'*) p="$HOME_DIR${p#\~}" ;;
    '~'*) deny "rm -r on another user's home directory" ;;
  esac
  p=${p/#\$\{HOME\}/$HOME_DIR}
  p=${p/#\$HOME/$HOME_DIR}
  [[ $p == *'$'* ]] && deny "rm -r with an unresolved variable target"
  [[ $p == *'.*' ]] && deny "rm -r with a dot-glob target"
  [[ $p == /* ]] || p="$cwd/$p"
  r=$(resolve "$p")
  [ "$r" = "/" ] && deny "rm -r targeting /"
  [ "$r" = "$ROOT_R" ] && deny "rm -r on the project root"
  [ "$r" = "$ROOT_R/.git" ] && deny "rm -r on the git directory"
  [[ $r == "$ROOT_R"/* ]] || deny "rm -r outside the project ($r)"
}

check_rm() {
  local recursive=0 endopts=0 x
  local -a targets=()
  for x in "$@"; do
    if [ "$endopts" = 0 ]; then
      case "$x" in
        --) endopts=1; continue ;;
        --recursive) recursive=1; continue ;;
        --*) continue ;;
        -*) [[ $x == *[rR]* ]] && recursive=1; continue ;;
      esac
    fi
    targets+=("$x")
  done
  [ "$recursive" = 1 ] || return 0
  for x in "${targets[@]+"${targets[@]}"}"; do check_rm_target "$x"; done
}

check_git() {
  local -a a=("$@")
  local k=0 sub="" x hard=0 remotes remote_re
  while [ "$k" -lt "${#a[@]}" ]; do
    case "${a[k]}" in
      -C | -c | --git-dir | --work-tree | --namespace) k=$((k + 2)) ;;
      -*) k=$((k + 1)) ;;
      *) sub=${a[k]}; k=$((k + 1)); break ;;
    esac
  done
  local -a rest=("${a[@]:k}")
  case "$sub" in
    push)
      for x in "${rest[@]+"${rest[@]}"}"; do
        case "$x" in
          --force | --force-with-lease | --force-with-lease=* | --force-if-includes) deny "git force-push" ;;
          --*) ;;
          -*f*) deny "git force-push" ;;
          +*) deny "git force-push via +refspec" ;;
        esac
      done
      ;;
    reset)
      for x in "${rest[@]+"${rest[@]}"}"; do [ "$x" = "--hard" ] && hard=1; done
      [ "$hard" = 1 ] || return 0
      remotes=$(git -C "$ROOT_R" remote 2>/dev/null | tr '\n' '|')
      remote_re="^(origin|upstream|${remotes%|})/"
      for x in "${rest[@]+"${rest[@]}"}"; do
        if [[ $x =~ $remote_re || $x == *'@{u'* || $x == refs/remotes/* ]]; then
          deny "git reset --hard onto a remote branch"
        fi
      done
      ;;
  esac
}

analyze_segment() {
  local -a t=()
  read -ra t <<<"$1" || true
  local n=${#t[@]} i=0 k after_prefix=0 w
  [ "$n" -gt 0 ] || return 0
  for ((k = 0; k < n; k++)); do
    w=${t[k]//\"/}
    t[k]=${w//\'/}
  done

  while [ "$i" -lt "$n" ]; do
    w=${t[i]}
    if [[ $w =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then i=$((i + 1)); continue; fi
    case "$w" in
      sudo | doas | command | builtin | exec | nohup | time | nice | xargs | then | do | else | if | while | until | '!' | '{')
        after_prefix=1; i=$((i + 1)); continue ;;
    esac
    if [ "$after_prefix" = 1 ] && [[ $w == -* ]]; then i=$((i + 1)); continue; fi
    break
  done
  [ "$i" -lt "$n" ] || return 0

  local c0=${t[i]##*/}
  c0=${c0#\\}
  local -a args=("${t[@]:i+1}")
  local na=${#args[@]}

  # Input redirection from a secret file, regardless of the command.
  for ((k = 0; k < na; k++)); do
    if [[ ${args[k]} == '<'?* ]] && is_secret_file "${args[k]}"; then deny "reading a secrets file"; fi
    if [ "${args[k]}" = '<' ] && [ $((k + 1)) -lt "$na" ] && is_secret_file "${args[k + 1]}"; then deny "reading a secrets file"; fi
  done

  case "$c0" in
    printenv) deny "printing environment variables (may expose secrets)" ;;
    env)
      k=0
      while [ "$k" -lt "$na" ]; do
        w=${args[k]}
        if [ "$w" = "-u" ] || [ "$w" = "--unset" ]; then k=$((k + 2)); continue; fi
        if [[ $w == -* || $w =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then k=$((k + 1)); continue; fi
        break
      done
      [ "$k" -ge "$na" ] && deny "printing environment variables (may expose secrets)"
      analyze_segment "${args[*]:k}"
      ;;
    export | declare | typeset | set)
      for w in "${args[@]+"${args[@]}"}"; do
        case "$w" in -p | -x | -px | -xp) ;; *) return 0 ;; esac
      done
      deny "dumping shell/environment variables (may expose secrets)"
      ;;
    rm) check_rm "${args[@]+"${args[@]}"}" ;;
    git) check_git "${args[@]+"${args[@]}"}" ;;
    gh)
      if [[ " ${args[*]-} " == *" auth "* ]] && [[ " ${args[*]-} " =~ \ (token|--show-token|-t)\  ]]; then
        deny "printing the GitHub auth token"
      fi
      ;;
    cat | less | more | head | tail | bat | batcat | tac | nl | strings | xxd | od | hexdump | grep | egrep | fgrep | rg | ag | \
      sed | awk | gawk | cut | sort | uniq | base64 | cp | mv | scp | rsync | source | . | vim | vi | nano | code | jq | yq | \
      python | python3 | node | curl | tee | diff | wc)
      for w in "${args[@]+"${args[@]}"}"; do
        is_secret_file "${w#@}" && deny "reading or copying a secrets file"
      done
      ;;
  esac
}

analyze() {
  local text=${1//$'\t'/ } line
  text=$(printf '%s\n' "$text" | sed -E 's/(&&|\|\||;|\||&|\$\(|`|\(|\))/\n/g')
  while IFS= read -r line; do analyze_segment "$line"; done <<<"$text"
}

# --- Whole-string checks -----------------------------------------------------
[[ $cmd == *.hermes* ]] && deny "touching ~/.hermes is forbidden"

re_pipe_sh='(curl|wget)[^|]*\|[[:space:]]*(sudo[[:space:]]+)?([^[:space:]|]*/)?(ba|z|k|da|fi)?sh([[:space:]]|$)'
re_pipe_interp='(curl|wget)[^|]*\|[[:space:]]*(sudo[[:space:]]+)?(python3?|node|perl|ruby)([[:space:]]|$)'
re_subst_sh='(ba|z|k|da)?sh[[:space:]]+(-[a-z]+[[:space:]]+)*["'\'']?(<\(|\$\()[[:space:]]*(curl|wget)'
re_source='(source|\.)[[:space:]]+<\([[:space:]]*(curl|wget)'
if [[ $cmd =~ $re_pipe_sh || $cmd =~ $re_pipe_interp || $cmd =~ $re_subst_sh || $cmd =~ $re_source ]]; then
  deny "piping a downloaded script into a shell/interpreter"
fi

lc=${cmd,,}
re_echo_secret='(echo|printf|print)[^;|&]*\$\{?[a-z0-9_]*(key|token|secret|passw|credential)'
[[ $lc =~ $re_echo_secret ]] && deny "printing a secret-looking environment variable"
[[ $lc == */proc/*/environ* ]] && deny "reading a process environment"

# --- Per-command checks (second pass treats quotes as separators, catching bash -c "...") ---
analyze "$cmd"
analyze "$(printf '%s' "$cmd" | tr "\"'" '\n\n')"

emit '{"permission":"allow"}'
