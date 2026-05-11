# Updating Prices

The site reads pricing from `data/races.json` at page load. **Edit that one file and every race page updates.** No code changes needed.

## When prices tier up (manual)

1. SSH to the Dell:
   ```bash
   cd ~/static-sites/happilyrunning-dev
   nano data/races.json
   ```

2. Find the race (e.g. `"teslahertz"`), update the `pricing.tiers` array. Each tier has:
   - `label` — display name (e.g. "100 Miler")
   - `price` — current price as a number (e.g. `225`)
   - `after` — what the price WILL be at the next increase (optional, currently unused but kept for future)
   - `after_date` — ISO date when next increase happens (optional)

3. Update `pricing.next_increase` to the next tier-up date as `YYYY-MM-DD`. This drives the "Prices increase {date}" text in the registration card.

4. Update `pricing.from` to whatever the lowest visible tier price is.

5. Save and exit.

6. Refresh any race page in browser — should see new prices immediately. No deploy, no rsync, no nginx restart.

## Cache busting

`data/races.json` is fetched with `cache: 'no-cache'`, so changes show up on next page load. If Cloudflare ever caches it (which can happen on the production site), bump the cache-buster by editing the JSON's `_meta.version` to a new number.

## Adding a new race

1. Add an entry under `races` keyed by slug (e.g. `"darksky220"`)
2. Use an existing race entry as a template
3. Create the race page at `races/<slug>.html` (copy an existing one)
4. Make sure the page's pricing list and registration card have:
   - `<div class="sidebar-card" data-pricing-card="<slug>">`
   - `<p data-pricing-increase>Prices increase ...</p>` (inside that card)
   - `<ul class="sidebar-pricing" data-pricing-list="<slug>">`

## Future automation (when ready)

The end goal is the Dell scraping UltraSignup + RaceRoster on a cron and writing `races.json` automatically. Then `git push` to whatever Git repo backs the production site. The site picks up new prices within minutes of registration platforms changing them.

For now, manual edits are fast enough — typical price-tier changes happen 2–4 times per race per year.
