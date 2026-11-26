#!/usr/bin/env bash
# apm-audit.sh — sensor: agent config deployed from .apm/ has not drifted (Day 4-03 Lab 4).
#
# Runs `apm audit --ci` and fails on any failed check. The only tolerated finding is
# "unmanaged-conflict" drift on a file listed in scripts/apm-audit.allow (with a reason).
# Edit agent config in .apm/, then `apm install`; never hand-edit the deployed copies.
#
# Usage: scripts/apm-audit.sh      Exit: 0 = clean, 1 = drift/violation, 0 + SKIP if apm missing
set -uo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR" || exit 1
if ! command -v apm >/dev/null 2>&1; then
  echo "SKIP apm-audit: apm not installed (brew install apm)"
  [ "${CI:-}" = "true" ] && exit 1
  exit 0
fi
json=$(apm audit --ci -f json 2>/dev/null)
printf '%s' "$json" | python3 -c '
import json, sys
allow = set()
for line in open("scripts/apm-audit.allow"):
    line = line.strip()
    if line and not line.startswith("#"):
        allow.add(line.split()[0])
d = json.loads(sys.stdin.read())
bad = []
for c in d.get("checks", []):
    if c["passed"]:
        continue
    if c["name"] == "drift":
        continue
    bad.append(c["name"] + ": " + c.get("message", ""))
dr = d.get("drift", [])
if isinstance(dr, dict):
    dr = dr.get("drift", [])
for x in dr:
    if x["kind"] == "unmanaged-conflict" and x["path"] in allow:
        continue
    bad.append("drift " + x["kind"] + ": " + x["path"])
if bad:
    print("✗ apm-audit: agent config drifted from .apm/")
    for b in bad:
        print("    " + b)
    print("  fix: edit the source under .apm/ and run `apm install` (never edit the deployed copy);")
    print("       for hash drift, `apm install` restores the deployed file.")
    sys.exit(1)
print("✓ apm-audit: deployed agent config matches .apm/ (%d documented platform-specific exemption(s))" % len(allow))
'
