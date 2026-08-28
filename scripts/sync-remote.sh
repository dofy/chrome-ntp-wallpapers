#!/usr/bin/env bash
# Push the library and the built app to a remote box over ssh.
#
#   scripts/sync-remote.sh            # code + images
#   scripts/sync-remote.sh images     # just images/
#   scripts/sync-remote.sh code       # just api/ + dist/
#
#   REMOTE_HOST=my-box REMOTE_DIR=/srv/ntp scripts/sync-remote.sh
#
# Why not scp -r or a single tar: over a long-haul tunnel the stream gets cut
# mid-transfer, and tar happily extracts the truncated prefix. A "no error
# printed" run can leave half a collection on disk. So this compares the two
# sides by path AND byte count, sends only the difference in small batches,
# checks the exit status of every pipe, and repeats until the difference is
# empty. rsync would do all of this, but OpenWrt boxes rarely have it.
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-Nano-tunnel}"
REMOTE_DIR="${REMOTE_DIR:-/mnt/NanoData/ntp-gallery}"
BATCH="${BATCH:-15}"
ROUNDS="${ROUNDS:-6}"
MODE="${1:-all}"

cd "$(dirname "$0")/.."
SSH=(ssh -o ConnectTimeout=20 -o BatchMode=yes "$REMOTE_HOST")
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# BSD find has no -printf; GNU stat has no -f. Normalise to "<path>\t<size>".
local_manifest() {
  if stat -f '%z' . >/dev/null 2>&1; then
    find images -type f -not -name '._*' -exec stat -f '%N%t%z' {} +
  else
    find images -type f -not -name '._*' -printf '%p\t%s\n'
  fi
}

deploy_code() {
  echo "== code: api/ + dist/"
  [ -d dist ] || { echo "   dist/ missing - run 'pnpm build' first" >&2; return 1; }
  # Wipe dist first: Vite content-hashes filenames, so a redeploy otherwise
  # leaves every previous build's assets behind as orphans.
  "${SSH[@]}" "cd '$REMOTE_DIR' && rm -rf dist && mkdir -p dist"
  COPYFILE_DISABLE=1 tar --no-xattrs -cf - --exclude='__pycache__' api dist \
    | "${SSH[@]}" "tar xpf - -C '$REMOTE_DIR'"
  "${SSH[@]}" "cd '$REMOTE_DIR' && find . -name '._*' -delete; python3 -m py_compile api/*.py"
  echo "   ok"
}

sync_images() {
  local_manifest | sort > "$TMP/local.tsv"
  echo "== images: $(wc -l < "$TMP/local.tsv" | tr -d ' ') files locally"

  local round n
  for ((round = 1; round <= ROUNDS; round++)); do
    if ! "${SSH[@]}" "cd '$REMOTE_DIR' && find images -type f -printf '%p\t%s\n' 2>/dev/null | sort" \
         > "$TMP/remote.tsv"; then
      echo "   [round $round] could not read the remote manifest, retrying"
      sleep 10
      continue
    fi
    # Present locally but missing remotely, or there with a different size.
    comm -23 "$TMP/local.tsv" "$TMP/remote.tsv" | cut -f1 > "$TMP/missing.txt"
    n=$(wc -l < "$TMP/missing.txt" | tr -d ' ')
    echo "   [round $round] $n to send"
    [ "$n" -eq 0 ] && { echo "   converged"; return 0; }

    rm -f "$TMP"/batch-*
    split -l "$BATCH" "$TMP/missing.txt" "$TMP/batch-"
    for b in "$TMP"/batch-*; do
      if COPYFILE_DISABLE=1 tar --no-xattrs -cf - -T "$b" \
         | "${SSH[@]}" "tar xpf - -C '$REMOTE_DIR'"; then
        printf '     %s: %s ok\n' "${b##*-}" "$(wc -l < "$b" | tr -d ' ')"
      else
        printf '     %s: %s failed, will retry\n' "${b##*-}" "$(wc -l < "$b" | tr -d ' ')"
      fi
    done
  done

  echo "   still $n file(s) short after $ROUNDS rounds" >&2
  return 1
}

case "$MODE" in
  code)   deploy_code ;;
  images) sync_images ;;
  all)    deploy_code; sync_images ;;
  *)      echo "usage: $0 [all|code|images]" >&2; exit 2 ;;
esac

# Report from the far side rather than trusting the steps above.
"${SSH[@]}" "cd '$REMOTE_DIR' && echo \"== remote: \$(find images -type f | wc -l) images, \$(du -sh images | cut -f1)\""
