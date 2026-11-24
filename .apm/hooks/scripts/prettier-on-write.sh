#!/usr/bin/env bash
# PostToolUse on Write|Edit: format the touched file with Prettier, silently.
FILE_PATH=$(jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0
case "$FILE_PATH" in */node_modules/*) exit 0 ;; esac
PRETTIER=("$CLAUDE_PROJECT_DIR/api/node_modules/.bin/prettier")
[ -x "${PRETTIER[0]}" ] || PRETTIER=(npx prettier)
"${PRETTIER[@]}" --write --ignore-unknown "$FILE_PATH" >/dev/null 2>&1 || true
exit 0
