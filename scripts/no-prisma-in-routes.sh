#!/usr/bin/env bash
# no-prisma-in-routes.sh — sensor: route handlers must not touch Prisma.
#
# Layering (AGENT.md, CLAUDE.md): routes/* parse + validate + map status codes;
# services/* own every Prisma call. Fails on any route file that imports
# @prisma/client or lib/prisma, or calls prisma.<model>.
#
# Suppression is a decision: a route may be exempt only if it is listed in
# scripts/no-prisma-in-routes.allow with a reason and a tracking card.
#
# Usage: scripts/no-prisma-in-routes.sh
# Exit:  0 = clean, 1 = violation(s)
set -uo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR" || exit 1
ALLOW="scripts/no-prisma-in-routes.allow"

allowed() {
  [ -f "$ALLOW" ] && grep -v '^\s*#' "$ALLOW" | awk '{print $1}' | grep -qxF "$1"
}

fail=0
hits=$(grep -rnE "from ['\"](@prisma/client|(\.\./)+lib/prisma)['\"]|new PrismaClient|\bprisma\.[a-zA-Z]+\." api/src/routes 2>/dev/null || true)
if [ -n "$hits" ]; then
  while IFS= read -r line; do
    file="${line%%:*}"
    if allowed "$file"; then continue; fi
    if [ "$fail" -eq 0 ]; then
      echo "✗ no-prisma-in-routes: route handlers must not access Prisma directly"
    fi
    echo "    $line"
    fail=1
  done <<< "$hits"
fi

if [ "$fail" -ne 0 ]; then
  echo "  fix: move the query into a function in api/src/services/<name>Service.ts (use lib/prisma.ts),"
  echo "       call it from the route, and map its result to the HTTP status there."
  echo "       Reference: routes/registrations.ts → services/registrationService.ts"
  exit 1
fi
n=$( [ -f "$ALLOW" ] && grep -cv '^\s*#\|^\s*$' "$ALLOW" || echo 0)
echo "✓ no-prisma-in-routes: routes are clean (${n} documented exemption(s) in $ALLOW)"
