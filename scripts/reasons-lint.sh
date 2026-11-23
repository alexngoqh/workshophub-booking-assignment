#!/usr/bin/env bash
# reasons-lint.sh — sensor: every SPDD prompt file must follow the REASONS Canvas.
#
# Checks each spdd/prompt/*.md (or the files passed as arguments) for:
#   - an H1 title
#   - the seven REASONS sections as H2, in order:
#       Requirements, Entities, Approach, Structure, Operations, Norms, Safeguards
#   - each section has non-empty content
#   - Operations contains at least one numbered "### N." step
#
# Usage: scripts/reasons-lint.sh [file ...]
# Exit:  0 = all files pass, 1 = at least one violation, 2 = no files found
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SECTIONS=(Requirements Entities Approach Structure Operations Norms Safeguards)

if [ "$#" -gt 0 ]; then
  FILES=("$@")
else
  shopt -s nullglob
  FILES=("$ROOT_DIR"/spdd/prompt/*.md)
  shopt -u nullglob
fi

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "reasons-lint: no SPDD prompt files found in spdd/prompt/" >&2
  exit 2
fi

failures=0

lint_file() {
  local file="$1" errors=() rel
  rel="${file#"$ROOT_DIR"/}"

  if [ ! -f "$file" ]; then
    echo "✗ $rel: file not found"
    return 1
  fi

  grep -qE '^# [^[:space:]]' "$file" || errors+=("missing H1 title")

  # Ordered list of H2 headings actually present
  local headings
  headings="$(grep -E '^## ' "$file" | sed -E 's/^## +//; s/[[:space:]]+$//')"

  local last_line=0 section line
  for section in "${SECTIONS[@]}"; do
    line="$(grep -nE "^## +${section}[[:space:]]*$" "$file" | head -1 | cut -d: -f1)"
    if [ -z "$line" ]; then
      errors+=("missing section '## ${section}'")
      continue
    fi
    if [ "$line" -lt "$last_line" ]; then
      errors+=("section '## ${section}' is out of order (expected R-E-A-S-O-N-S)")
    fi
    last_line="$line"

    # Section body = lines until next H2 (or EOF); must contain non-blank text
    local body
    body="$(awk -v start="$line" 'NR>start && /^## /{exit} NR>start' "$file" | grep -vE '^[[:space:]]*$' | head -1)"
    [ -n "$body" ] || errors+=("section '## ${section}' is empty")
  done

  # Duplicate REASONS sections
  for section in "${SECTIONS[@]}"; do
    local count
    count="$(printf '%s\n' "$headings" | grep -cxE "${section}")"
    [ "$count" -le 1 ] || errors+=("section '## ${section}' appears ${count} times")
  done

  # Operations must have numbered steps
  if awk '/^## +Operations/{f=1;next} /^## /{f=0} f' "$file" | grep -qE '^### +[0-9]+\.'; then :; else
    grep -qE '^## +Operations' "$file" && errors+=("'## Operations' has no numbered '### N.' steps")
  fi

  if [ "${#errors[@]}" -eq 0 ]; then
    echo "✓ $rel"
    return 0
  fi
  echo "✗ $rel"
  local e
  for e in "${errors[@]}"; do echo "    - $e"; done
  return 1
}

for f in "${FILES[@]}"; do
  lint_file "$f" || failures=$((failures + 1))
done

echo
if [ "$failures" -gt 0 ]; then
  echo "reasons-lint: ${failures} of ${#FILES[@]} file(s) violate the REASONS structure"
  exit 1
fi
echo "reasons-lint: ${#FILES[@]} file(s) OK"
