# DEPLOY.md — Claude Code brief for Happily Running staging

This is the handoff brief from Claude.ai (strategy) to Claude Code (execution) for getting the redesigned Happily Running site running on the Dell.

## Goal

Stand up the v0.3.0 static site at `happilyrunning-dev.vinnycapp.com` so Vinny can click through it like a real site, add photos, and iterate until it's ready to swap the real DNS.

**Do NOT point happilyrunning.com at this yet.** Staging only.

## Context

- Dell server, Ubuntu 24.04, local IP 192.168.68.103
- Existing nginx-static on port 8100 (serves `/home/vin/static-sites/`)
- Cloudflare Tunnel ID `e60d22e1-4262-4b16-a0b3-d8d03aa839da` already set up for `vinnycapp.com` and subdomains
- PM2 running other services; this is pure static files — no PM2 needed

## Steps

1. **Upload the site folder to the Dell**
   - Source: `hr-site-v0.3.0.zip` (Vinny will SCP it up from the Surface)
   - Destination: `/home/vin/static-sites/happilyrunning-dev/`
   - Unzip, verify `index.html` is at the root of that folder

2. **Configure nginx**
   - Add a new server block or use the existing nginx-static pattern
   - Server name: `happilyrunning-dev.vinnycapp.com`
   - Root: `/home/vin/static-sites/happilyrunning-dev/`
   - Ensure `try_files $uri $uri/ $uri.html =404;` so `/timing` resolves to `/timing.html` (the nav links don't include `.html` extensions)
   - Reload nginx: `sudo nginx -t && sudo systemctl reload nginx`

3. **Cloudflare Tunnel**
   - Add `happilyrunning-dev.vinnycapp.com` to the tunnel config
   - Point it at `http://localhost:<port>` wherever nginx is serving this vhost
   - Restart cloudflared: `sudo systemctl restart cloudflared`

4. **Verify**
   - Visit `https://happilyrunning-dev.vinnycapp.com/` — homepage loads
   - Visit `/races/` — race index loads
   - Visit `/races/shore2shore` — individual race page loads (trailing slash and no-extension both should work)
   - Visit `/timing`, `/about`, `/volunteer`, `/contact` — all resolve
   - Mobile viewport (DevTools) — hamburger menu opens and closes

5. **Report back**
   - Staging URL
   - Any 404s found
   - Any console errors
   - nginx config snippet so Vinny can keep it in the dell-server-reference.md

## Important notes

- Race card backgrounds are currently solid colors (forest/moss/bark) — this is intentional until photos are added. Do NOT generate placeholder images.
- There are a few intentional `href="#"` placeholders for "Lodging" and "Parking info" — leave alone.
- The `assets/partials.html` file is a reference-only copy of header/footer snippets. It should NOT be linked from any page.

## After staging

Vinny will:
1. Click through, note what needs fixing
2. Drop race photos into `/assets/img/` with the right filenames (see PHOTOS.md)
3. Get the new logo from a separate Claude.ai chat
4. Come back to Claude.ai for v0.4 revisions before swapping real DNS

## Reference

- `dell-server-reference.md` at `/home/vin/dell-server-reference.md` — add a new section for this vhost
