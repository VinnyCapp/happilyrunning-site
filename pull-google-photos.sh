#!/usr/bin/env bash
# pull-google-photos.sh — scrape a Google Photos shared album and generate gallery JSON
#
# Usage:
#   bash pull-google-photos.sh <slug> <album_url>
#   bash pull-google-photos.sh shore2shore "https://photos.google.com/album/AF1QipPABuowY51dGXvijVJ7R_AmVsn2qxhzus4WBy61"

set -e

SLUG="$1"
URL="$2"

if [[ -z "$SLUG" || -z "$URL" ]]; then
  echo "Usage: $0 <slug> <album_url>"
  echo ""
  echo "Example:"
  echo "  $0 shore2shore \"https://photos.google.com/album/AF1QipPABuowY51dGXvijVJ7R_AmVsn2qxhzus4WBy61\""
  exit 1
fi

OUT="data/galleries/${SLUG}.json"
TMP=$(mktemp /tmp/gphotos.XXXXXX.html)
mkdir -p data/galleries

echo "Fetching $URL ..."
curl -sL -H "User-Agent: Mozilla/5.0 (compatible; HR-gallery-bot/1.0)" "$URL" > "$TMP"

SIZE=$(stat -c %s "$TMP" 2>/dev/null || stat -f %z "$TMP")
echo "Downloaded $SIZE bytes"

export GPHOTOS_URL="$URL"
export GPHOTOS_FILE="$TMP"
export GPHOTOS_OUT="$OUT"

python3 <<'PY'
import re
import os
import json
import datetime

html_path = os.environ['GPHOTOS_FILE']
source_url = os.environ['GPHOTOS_URL']
out_path = os.environ['GPHOTOS_OUT']

with open(html_path, 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

urls = set()
for m in re.finditer(r'https://lh3\.googleusercontent\.com/[A-Za-z0-9_\-/]+', html):
    base = m.group(0)
    base = re.sub(r'=[wh\d\-a-zA-Z]+$', '', base)
    if '/pw/' in base or '/a/' in base:
        urls.add(base)

photos = []
for u in sorted(urls):
    photos.append({
        "thumb": u + "=w600-h450-no",
        "full": u + "=w2000-h1500-no"
    })

output = {
    "_meta": {
        "description": "Scraped from Google Photos album at " + datetime.datetime.now().isoformat(),
        "source_url": source_url,
        "photo_count": len(photos)
    },
    "album_url": source_url,
    "photos": photos
}

with open(out_path, 'w') as f:
    json.dump(output, f, indent=2)

print("Wrote " + str(len(photos)) + " photos to " + out_path)

if len(photos) == 0:
    print("")
    print("No photos found. Possible reasons:")
    print("  1. Album isn't publicly shared (check sharing settings)")
    print("  2. Google changed their HTML structure (may need script update)")
    print("  3. URL is malformed")
    print("")
    print("Raw HTML saved to " + html_path + " for inspection.")
else:
    os.remove(html_path)
PY
