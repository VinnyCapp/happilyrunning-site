#!/usr/bin/env bash
# deploy-prod.sh v1.0 — build + upload happilyrunning.com (Cloudflare Pages, Direct Upload)
#
#   scripts/deploy-prod.sh            # pull main, build, upload
#   NO_PULL=1 scripts/deploy-prod.sh  # rebuild + upload what's checked out (date refresh only)
#
# Run from a clean checkout of main (~/hr-site-prod), never the dev dir.
# Uploads ONLY web files: a filtered copy goes to $DIST, so docs, scripts, dotfiles and
# backups are never published. Credentials come from a chmod-600 env file:
#   ~/.config/hr/cloudflare.env
#     export CLOUDFLARE_API_TOKEN=...   (Account > Cloudflare Pages > Edit)
#     export CLOUDFLARE_ACCOUNT_ID=...
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DIST="${DIST:-$HOME/hr-site-prod-dist}"
ENV_FILE="${ENV_FILE:-$HOME/.config/hr/cloudflare.env}"
WRANGLER="wrangler@3.114.17"

[ -f "$ENV_FILE" ] && . "$ENV_FILE"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN not set (expected in $ENV_FILE)}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID not set (expected in $ENV_FILE)}"
export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID

cd "$SRC"
[ "${NO_PULL:-0}" = 1 ] || git pull -q --ff-only origin main
node scripts/build-site.js

mkdir -p "$DIST"
rsync -a --delete \
  --exclude='.*' --exclude='*.md' --exclude='*.sh' --exclude='scripts/' \
  --exclude='*.backup-*' --exclude='node_modules/' \
  --exclude='hr-copy-edits-*' --exclude='CLAUDE_CODE_BRIEF_*' \
  "$SRC/" "$DIST/"

# Safety net: never publish infra details.
if grep -rlqE "e60d22e1|192\.168\.68\.|100\.65\.194\.93" "$DIST"; then
  echo "REFUSING: infra details found in $DIST:"; grep -rlE "e60d22e1|192\.168\.68\.|100\.65\.194\.93" "$DIST"; exit 1
fi
[ -f "$DIST/index.html" ] && [ -f "$DIST/_redirects" ] || { echo "REFUSING: dist incomplete"; exit 1; }

npx --yes "$WRANGLER" pages deploy "$DIST" --project-name=happilyrunning --branch=main \
  --commit-hash="$(git rev-parse HEAD)" --commit-message="$(git log -1 --format=%s)" --commit-dirty=true
echo "deployed $(git rev-parse --short HEAD) at $(date -Is)"
