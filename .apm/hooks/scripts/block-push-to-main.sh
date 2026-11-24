#!/usr/bin/env bash
# PreToolUse on Bash: block direct pushes to main. Exit 2 = block and show stderr to Claude.
COMMAND=$(jq -r '.tool_input.command // empty')
if [[ "$COMMAND" =~ git[[:space:]]+push ]] && [[ "$COMMAND" =~ (^|[^[:alnum:]_-])main([^[:alnum:]_-]|$) ]]; then
  echo "Direct push to main is forbidden. Push a feature branch and open a PR." >&2
  exit 2
fi
exit 0
