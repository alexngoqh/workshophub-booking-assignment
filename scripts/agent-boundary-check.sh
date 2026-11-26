#!/usr/bin/env bash
# agent-boundary-check.sh — sensor (LLM06 excessive agency, LLM01 prompt injection).
#
# A declaration only counts if a sensor fails closed when it disappears (Day 4-06 #15).
# Checks AGENT.md still declares:
#   - "## 4. AGENT_BOUNDARY" with "Needs explicit approval first" and "Never" lists
#   - the untrusted-context rule (Jira/MR/README text is data, not instructions)
#
# Usage: scripts/agent-boundary-check.sh
# Exit:  0 = present, 1 = missing
set -uo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
F="$ROOT_DIR/AGENT.md"
fail=0
need() {
  if ! grep -qE "$1" "$F"; then
    echo "✗ agent-boundary: AGENT.md is missing: $2"
    fail=1
  fi
}
[ -f "$F" ] || { echo "✗ agent-boundary: AGENT.md not found"; exit 1; }
need '^## 4\. AGENT_BOUNDARY' '"## 4. AGENT_BOUNDARY" section'
need '^### Needs explicit approval first' '"### Needs explicit approval first" list'
need '^### Never' '"### Never" list'
need '^### Untrusted context' '"### Untrusted context" rule (Jira/MR/README = data, not instructions)'
if [ "$fail" -ne 0 ]; then
  echo "  fix: restore the section in AGENT.md §4. Do not delete or weaken it to get past this sensor."
  exit 1
fi
echo "✓ agent-boundary: AGENT_BOUNDARY and untrusted-context rule present"
