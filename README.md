# Happily Running Website — v0.3.0

A static HTML site. No framework, no build step, no dependencies. Drop it on any web server and it works.

## Structure

```
hr-site/
├── index.html              # Homepage
├── races/
│   ├── index.html          # All races
│   ├── shore2shore.html    # Full-featured template (banner, FAQ, schedule)
│   ├── virgilcrest.html
│   ├── greekpeak.html
│   ├── watergap.html
│   ├── teslahertz.html
│   └── racetheghost.html   # Teaser page (coming soon)
├── timing.html             # B2B timing services pitch
├── about.html
├── volunteer.html
├── contact.html
├── assets/
│   ├── css/site.css        # All styling — CSS variables at top for easy theme changes
│   ├── js/site.js          # Tiny nav toggle + scroll reveal
│   ├── img/                # Drop race photos here (see TODO below)
│   └── partials.html       # Reference for shared header/footer — NOT loaded at runtime
└── data/
    └── races.json          # Single source of truth for race metadata and pricing
```

## Running locally

From the `hr-site/` root:

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765` (or `http://192.168.68.103:8765` from another machine on the LAN).

## Deploying to the Dell

Suggested: add an nginx server block and map this folder to `happilyrunning-dev.vinnycapp.com` via Cloudflare Tunnel. Staging only — don't point the real domain here until we've added photos and done a full QA pass.

See `DEPLOY.md` for the Claude Code brief.

## Changing prices

Edit `data/races.json` only. The race pages currently hardcode a few prices in the sidebar — v0.4 will wire those up to read from the JSON. For now, if you tier up a price, update:

1. `data/races.json` (canonical)
2. The sidebar `.sidebar-card` on the relevant race page
3. The "from $X" in the race card on homepage + `/races/index.html`

## TODO (before real domain)

- [ ] Add race photos (`/assets/img/shore2shore-hero.jpg`, `virgilcrest-hero.jpg`, etc.) — see `PHOTOS.md`
- [ ] Swap placeholder logos on `/timing.html` with actual client logos (Miles for Migraine + others)
- [ ] Swap the stand-in `Happily *Running*` wordmark for the new logo when it's ready
- [ ] Add `favicon.svg` to `/assets/img/`
- [ ] Decide if we're keeping `/coaching` (was on old site but not mentioned in redesign brief)
- [ ] v0.4: wire sidebar pricing to read from `races.json` via fetch

## Design system

All tokens live at the top of `assets/css/site.css`:

```
--forest, --forest-deep, --moss, --sage    # greens
--cream, --cream-soft                      # paper
--trail, --trail-warm                      # orange accents
--bark, --ash, --stone                     # neutrals

--font-display: Fraunces (variable serif)
--font-body: Inter
```

Change any of these and the whole site updates.
