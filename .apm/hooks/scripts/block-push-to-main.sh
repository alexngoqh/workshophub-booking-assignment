#!/usr/bin/env bash
# PreToolUse on Bash: block direct pushes to main. Exit 2 = block and show stderr to Claude.
# Checks each shell segment (split on && || ; | and newlines) on its own, so
# `git push -u origin feat && gh pr create --base main` is allowed, while
# `git push origin main`, `git push origin HEAD:main` and a bare `git push` on main are blocked.
COMMAND=$(jq -r '.tool_input.command // empty')
CURRENT=$(git -C "${CLAUDE_PROJECT_DIR:-.}" branch --show-current 2>/dev/null)
block() { echo "Direct push to main is forbidden ($1). Push a feature branch and open a PR." >&2; exit 2; }
while IFS= read -r seg; do
  [[ "$seg" =~ git[[:space:]]+push ]] || continue
  args="${seg#*push}"
  if [[ "$args" =~ (^|[[:space:]:/+])main([[:space:]]|$) ]]; then block "target main"; fi
  # no refspec (e.g. `git push`, `git push -u origin`) pushes the current branch
  ref=$(printf '%s\n' $args | grep -v '^-' | sed -n '2p')
  if [ -z "$ref" ] && [ "$CURRENT" = "main" ]; then block "current branch is main"; fi
done < <(printf '%s\n' "$COMMAND" | sed -E 's/(&&|\|\||;|\|)/\n/g')
exit 0
