# PHOTOS.md — Where to drop race images

The site is designed to host trail/race photos in specific slots. All images live in `/assets/img/`.

## Race card images (homepage + /races/)

Each card on the homepage and races index has a dark gradient overlay over a background image. Photos should be:

- **Aspect ratio:** landscape, ideally 3:2 or 16:9
- **Min resolution:** 1600×1000 (they'll be compressed client-side but we want headroom)
- **Style:** action/environment shots work best — runners on trail, trail itself, finish line crowd, aid station. Avoid tight portraits; the gradient overlays face-height areas.
- **Format:** `.jpg` (convert PNG → JPG for filesize)

### Required filenames

| Race | Filename |
|---|---|
| Shore2Shore | `shore2shore.jpg` |
| Virgil Crest | `virgilcrest.jpg` |
| Greek Peak | `greekpeak.jpg` |
| Water Gap | `watergap.jpg` |
| Tesla Hertz | `teslahertz.jpg` |
| Race the Ghost | `racetheghost.jpg` |

## Race page hero images

Same races, taller aspect ratio (16:9 or 21:9 landscape), higher resolution — these fill the full hero above the fold on each individual race page.

- **Aspect ratio:** landscape, 16:9 or wider
- **Min resolution:** 2400×1200
- **Style:** the "face" of each race — the one image that sells it. For Shore2Shore, maybe the underpass tunnel or a beach shot. For Virgil, a ridgeline. For Tesla, a Pine Barren scene.

### Required filenames

| Race | Filename |
|---|---|
| Shore2Shore | `shore2shore-hero.jpg` |
| Virgil Crest | `virgilcrest-hero.jpg` |
| Greek Peak | `greekpeak-hero.jpg` |
| Water Gap | `watergap-hero.jpg` |
| Tesla Hertz | `teslahertz-hero.jpg` |
| Race the Ghost | `racetheghost-hero.jpg` |

## Client logos (timing page)

The "Events we've timed" section on `/timing.html` has placeholder boxes. Swap them for real client logos:

- **Format:** transparent PNG or SVG preferred
- **Treatment:** monochrome or single-color preferred so they sit well on the cream background
- **Filenames:** `/assets/img/clients/<event-name>.png` (create the `clients/` subfolder)

Then update the `<span>` elements in `timing.html` to `<img src="/assets/img/clients/miles-for-migraine.png" alt="Miles for Migraine">` etc.

## Favicon

- **File:** `/assets/img/favicon.svg`
- **Format:** SVG (preferred) or 512×512 PNG named `favicon.png` (and update the link tag in each page)
- **Suggestion:** wait until the new logo is done

## Pulling from Google Photos

Google Photos albums don't allow hotlinking. Recommended workflow:

1. Open the shared album
2. Select ~3-5 strong images per race
3. Download them to your Surface
4. Rename per the filename tables above
5. SCP them up to the Dell into `/home/vin/static-sites/happilyrunning-dev/assets/img/`

Or if you want a semi-automated way: drop the album links in a Claude Code chat and have it write a one-off script using `gphotos-cdp` or similar to pull your selections.

## Compression

Before uploading, run images through:

```bash
# On the Dell or your Surface with WSL
for f in *.jpg; do
  convert "$f" -resize "1600x>" -quality 82 "compressed/$f"
done
```

Target: each image under 200KB, ideally under 120KB. Lighter photos = faster pages = happier visitors.
