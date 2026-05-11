#!/usr/bin/env bash
# pull-typedream-photos.sh — download old site photos from Typedream CDN
# Run this on the Dell after you've unzipped the site folder.
# Usage:
#   cd /path/to/hr-site
#   bash pull-typedream-photos.sh
#
# Photos land in assets/img/typedream-raw/ — you pick the best ones and rename them per PHOTOS.md.

set -e

OUT_DIR="assets/img/typedream-raw"
mkdir -p "$OUT_DIR"

# Typedream CDN resize endpoint — request a good-quality 1920px version
BASE="https://image.typedream.com/cdn-cgi/image/width=1920,format=auto,fit=scale-down,quality=90/"

declare -A PHOTOS=(
  # ———— Shore2Shore ————
  [shore2shore-01]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2LNKzj7izIjdb8eb2MzCgVzbFak_PXL_20220409_120906652.jpg"
  [shore2shore-02]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2LNkNak5VxYpdsnz0jjelSbO9nJ_UNADJUSTEDNONRAW_thumb_f217.jpg"
  [shore2shore-03]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2LNl9UItWsoa3d4p5nUvJZkA7Vy_UNADJUSTEDNONRAW_thumb_1105c.jpg"
  [shore2shore-04]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2YxEe94mRIz3DvK4KOR4hj9vXk2_Shore2Shore_HR-20230415-1138.jpg"
  [shore2shore-05]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2YxH9eygjJYcs4RM7DueQl8I2yC_Shore2Shore_HR-20230415-0148.jpg"

  # ———— Tesla Hertz ————
  [teslahertz-01]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2KCTAYqUY2z2Si2sLqk1AzxjR3I_PXL_20221008_101400536.jpg"
  [teslahertz-02]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2KKe5foGlJXCisDHqXNbKVhQfsW_PXL_20221007_212703086.jpg"
  [teslahertz-03]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2KKfjCCcv7d6tU0fN2bbAgNpaeJ_20221009_044154_6_Pro_adj.jpg"
  [teslahertz-04]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2KKpI5JOCdC9QyZ7yOu7zsCaPln_20221008_162128_6_Pro_adj.jpg"
  [teslahertz-05]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2KKxAi3asWN6TQHjk9en2qSTo9X_PXL_20221008_101321939.jpg"
  [teslahertz-06]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2KL0thhEx63j7W5cu5B0jf88ihF_PXL_20221009_232705194.jpg"

  # ———— Water Gap ————
  [watergap-01]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2MQQXDb2yiWRNeJVfApRkgm9Yjj_PXL_20220923_214647674.jpg"
  [watergap-02]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2MQQtKwJsi9r2DeqLC2nAeLgclR_PXL_20210925_160802809_MP.jpg"
  [watergap-03]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2MSklZZxWTTqt3jQtt64BaY5pyG_IMG_7068.jpg"
  [watergap-04]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2MSshBT5gkvHELNKodedWfxKg1Y_PXL_20200912_143551344.jpg"

  # ———— Virgil Crest (RNR professional shots from 2021) ————
  [virgilcrest-01]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2PWrtG5OuPBz03faGsCNMtJIUHy_VirgilCrestUltras_RNR-20210911-0129_Large_.jpg"
  [virgilcrest-02]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2PWrx6OvOxcn3pdaUpxO29hq5oe_VirgilCrestUltras_RNR-20210911-0444_Large_.jpg"
  [virgilcrest-03]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2PWs2l5npfkIUzEHQcWU0r6vSto_VirgilCrestUltras_RNR-20210911-0073_Large_.jpg"
  [virgilcrest-04]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2PWsBFtuMdAWigz2ohj7nQIMUpQ_VirgilCrestUltras_RNR-20210911-0451_Large_.jpg"
  [virgilcrest-05]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2PWu9QoVGevi5Y106WGtMIYujLb_VirgilCrestUltras_RNR-20210911-0396_1_Large_.jpg"
  [virgilcrest-06]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2PWuBdysYm6vOsrAM3Sfd1PlPxG_VirgilCrestUltras_RNR-20210911-0183_Large_.jpg"
  [virgilcrest-07]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2PX6Q4J6hEuBQrE6xzbjPE98b7d_VirgilCrestUltras_RNR-20210911-0115_Large_.jpg"

  # ———— Generic / mixed (unknown race but may be reusable) ————
  [generic-canal]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2KQiKWV2B3RXrdQ6UpZT9US7fQg_PXL_20220924_213652600_1_.jpg"
  [generic-trail-01]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2KQiRDQKxdGbKe2hybb4455rb0g_PXL_20220910_121200449.jpg"
  [generic-trail-02]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2KQjmwsTeCNxABkih7WvmJ5nV1G_d60a0370-46f5-45e0-a54e-b2ea70482d64.jpg"
  [generic-trail-03]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2KQvhKlUTjZgpQVWfE01VxvFUl2_2022-09-18_1_.jpg"
  [generic-04]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2TOtnjWhTHiXLBUL4UV2KlqyoyE_IMG_7222.jpg"
  [generic-05]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2TOufCqMVR8prgZvDeYKapNUapi_IMG_20210804_231559.jpg"
  [generic-06]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2TOugoVoMulF29h0U7p3O88lPiP_IMG_7216.jpg"
  [home-gators]="https://api.typedream.com/v0/document/public/cebbfa5a-6526-4ad5-b528-5c2a288736ea/2YxFdw41JoCLAjo25AWdAo0mdTQ_gators.jpg"
)

echo "Downloading ${#PHOTOS[@]} photos → $OUT_DIR"
echo ""

ok=0
fail=0
for name in "${!PHOTOS[@]}"; do
  url="${PHOTOS[$name]}"
  out="$OUT_DIR/$name.jpg"
  if [[ -f "$out" ]]; then
    echo "⟳ $name.jpg (already exists, skipping)"
    continue
  fi
  # Set Referer so the CDN trusts the request
  if curl -sf -o "$out" \
       -H "Referer: https://www.happilyrunning.com/" \
       -H "User-Agent: Mozilla/5.0" \
       "${BASE}${url}"; then
    size=$(du -h "$out" | cut -f1)
    echo "✓ $name.jpg ($size)"
    ok=$((ok+1))
  else
    echo "✗ $name.jpg (failed)"
    rm -f "$out"
    fail=$((fail+1))
  fi
done

echo ""
echo "Done: $ok downloaded, $fail failed"
echo ""
echo "Next steps:"
echo "  1. Browse $OUT_DIR/ and pick the best shots per race"
echo "  2. Rename/copy the chosen ones into assets/img/ per PHOTOS.md:"
echo "     - <race>.jpg        (card image)"
echo "     - <race>-hero.jpg   (race page hero)"
echo "  3. Delete $OUT_DIR/ when you're done cherry-picking"
