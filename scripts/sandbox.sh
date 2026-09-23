#!/usr/bin/env bash
# Run untrusted code in a throwaway Docker container.
#
# Usage:
#   scripts/sandbox.sh                  # drop into bash, /work mounted read-only
#   scripts/sandbox.sh node script.js   # run a single command then exit
#   scripts/sandbox.sh -w               # mount /work writable (use with care)
#
# WHY: the user's standing rule for vetting copy-pasted code is "isolate first,
# trust never". This container has no network namespace shared with the host,
# no host filesystem access outside an explicit bind mount, and is destroyed
# on exit. AV scanners catch known-bad binaries; this catches the unknown.
#
# Image: node:20-bookworm-slim (Node + apt for one-off Python/Go installs).
# Network: enabled by default so npm/pip work — pass --no-network to disable.

set -euo pipefail

WRITABLE=0
NETWORK="bridge"
ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    -w|--writable) WRITABLE=1; shift ;;
    --no-network)  NETWORK="none"; shift ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) ARGS+=("$1"); shift ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  cat >&2 <<'EOF'
docker not found. Install one (both free):
  brew install --cask docker          # Docker Desktop (GUI)
  brew install colima docker          # Colima (CLI-only, lighter)

Then start it:
  open -a Docker                      # if Docker Desktop
  colima start                        # if Colima

EOF
  exit 1
fi

MOUNT_FLAG="ro"
[ "$WRITABLE" -eq 1 ] && MOUNT_FLAG="rw"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SANDBOX_TMP="$(mktemp -d)"
trap 'rm -rf "$SANDBOX_TMP"' EXIT

echo "→ sandbox: image=node:20-bookworm-slim network=${NETWORK} mount=${MOUNT_FLAG} scratch=${SANDBOX_TMP}" >&2

if [ ${#ARGS[@]} -eq 0 ]; then
  exec docker run --rm -it \
    --network "$NETWORK" \
    --read-only --tmpfs /tmp --tmpfs /home/node \
    -v "$REPO_ROOT":/work:"$MOUNT_FLAG" \
    -v "$SANDBOX_TMP":/scratch:rw \
    -w /scratch \
    --user node \
    --cap-drop=ALL \
    --security-opt no-new-privileges \
    node:20-bookworm-slim bash
else
  exec docker run --rm \
    --network "$NETWORK" \
    --read-only --tmpfs /tmp --tmpfs /home/node \
    -v "$REPO_ROOT":/work:"$MOUNT_FLAG" \
    -v "$SANDBOX_TMP":/scratch:rw \
    -w /scratch \
    --user node \
    --cap-drop=ALL \
    --security-opt no-new-privileges \
    node:20-bookworm-slim "${ARGS[@]}"
fi
