#!/usr/bin/env bash
# branch-name-check.sh — sensor: branch names must follow latc-<story>-<slug>.
#
# Valid:   latc-2-register-for-session, latc-12-cancel
# Invalid: LATC-2-foo, latc-2, latc-foo, feature/latc-2-x, latc-2-Foo_Bar
#
# Rule: ^latc-[1-9][0-9]*-[a-z0-9]+(-[a-z0-9]+)*$
#   - lowercase "latc-" prefix (the Jira project key)
#   - story number without leading zeros
#   - kebab-case slug: lowercase letters/digits, single hyphens, no trailing hyphen
#
# Exempt: main, detached HEAD, and any name in $BRANCH_NAME_EXEMPT (space-separated).
#
# Usage: scripts/branch-name-check.sh [branch-name]   (defaults to the current branch)
# Exit:  0 = valid or exempt, 1 = invalid name
set -euo pipefail

PATTERN='^latc-[1-9][0-9]*-[a-z0-9]+(-[a-z0-9]+)*$'
EXEMPT="main ${BRANCH_NAME_EXEMPT:-}"

branch="${1:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)}"

if [ -z "$branch" ]; then
  echo "branch-name-check: could not determine branch (not a git repo?)" >&2
  exit 1
fi

if [ "$branch" = "HEAD" ]; then
  echo "branch-name-check: detached HEAD, skipping"
  exit 0
fi

for e in $EXEMPT; do
  if [ "$branch" = "$e" ]; then
    echo "✓ '$branch' is exempt"
    exit 0
  fi
done

if [[ "$branch" =~ $PATTERN ]]; then
  echo "✓ '$branch' follows latc-<story>-<slug>"
  exit 0
fi

suggest="$(printf '%s' "$branch" | tr '[:upper:]_/ ' '[:lower:]---' | sed -E 's/[^a-z0-9-]//g; s/-+/-/g; s/^-|-$//g')"

echo "✗ '$branch' does not follow latc-<story>-<slug>"
echo "    expected: latc-<jira-number>-<kebab-case-slug>, e.g. latc-2-register-for-session"
if [[ "$suggest" =~ $PATTERN ]]; then
  echo "    rename:   git branch -m $branch $suggest"
else
  echo "    rename:   git branch -m $branch latc-<number>-<slug>"
fi
exit 1
