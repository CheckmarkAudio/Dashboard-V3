#!/usr/bin/env bash
# Scan the project's lockfile for known vulnerabilities using OSV-Scanner.
#
# OSV-Scanner is Google's free, open-source tool that hits OSV.dev — the
# canonical vulnerability database covering npm, PyPI, Go, Maven, etc.
# No account, no API key, no rate limit on local runs.
#
# Usage:
#   scripts/scan-deps.sh         # scan package-lock.json, exit non-zero on findings
#   scripts/scan-deps.sh --soft  # report findings but always exit 0 (advisory)

set -euo pipefail

SOFT=0
[ "${1:-}" = "--soft" ] && SOFT=1

if ! command -v osv-scanner >/dev/null 2>&1; then
  cat >&2 <<'EOF'
osv-scanner not found. Install (free):
  brew install osv-scanner

Or download a binary from https://github.com/google/osv-scanner/releases
EOF
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

echo "→ osv-scanner: scanning package-lock.json"
if osv-scanner --lockfile=package-lock.json; then
  echo "✅ no known vulnerabilities"
  exit 0
fi

# Non-zero exit = findings.
[ "$SOFT" -eq 1 ] && exit 0
exit 1
