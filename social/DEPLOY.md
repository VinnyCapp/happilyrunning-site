# Deploying hr-social on the Dell

Matches the Dell's conventions (see `dell-server-reference.md`): apps live in
`/home/vin/<name>/`, run under PM2 (`pm2-vin.service` → `pm2 resurrect`), and the
tunnel is **locally-managed** via `/etc/cloudflared/config.yml` (tunnel `dell-ssh`,
systemd).

End state: `https://social.vinnycapp.com` → Cloudflare Access login → dashboard,
served from `localhost:3955`. Port 3955 is free (next above the 3950–3953 cluster).

---

## 1. Put the service in place

Convention is one dir per service under `/home/vin/`:

```bash
# copy the social/ folder out of the repo to its own service dir
mkdir -p /home/vin/hr-social
cp -r <repo>/social/. /home/vin/hr-social/
cd /home/vin/hr-social
npm install --omit=dev

cp .env.example .env
nano .env                                  # fill in (see below)
```

In `.env` set at minimum:

```ini
ANTHROPIC_API_KEY=sk-ant-...
HR_SOCIAL_ACCOUNTS=[{"key":"happilyrunning","name":"Happily Running","ig_user_id":"<IG_USER_ID>","fb_page_id":"<PAGE_ID>","token_env":"HR_TOKEN_HAPPILYRUNNING","platforms":["instagram","facebook"]}]
HR_TOKEN_HAPPILYRUNNING=<long-lived Graph token>
# Start safe — flip to 0 after the first real walk-through:
HR_SOCIAL_DRY_RUN=1
```

> Keep `HR_SOCIAL_HOST=127.0.0.1` (default). The app stays on localhost; Cloudflare
> Access is the only auth gate. `.env` is loaded by Node's `--env-file`, so secrets
> never enter the PM2 dump.

## 2. Start under PM2 (and `pm2 save` — this is the critical step)

```bash
cd /home/vin/hr-social
pm2 start hr-social.mjs --name hr-social --node-args="--env-file=.env"
pm2 save                                   # re-snapshots the dump so it survives reboot
pm2 logs hr-social --lines 20              # expect: "listening on http://127.0.0.1:3955 [DRY RUN]"
```

Confirm the app is up (this isolates "app running" from "tunnel routing"):

```bash
curl -s http://127.0.0.1:3955/health | head -c 300
```

> If Node on the Dell predates v20.6, `--env-file` won't exist — in that case
> `set -a; . ./.env; set +a` before `pm2 start`, or add an `env_file` to an
> ecosystem config. Check with `node -v`.

## 3. Tunnel route — in config.yml on the Dell (NOT the dashboard)

This tunnel is locally-managed, so routing lives in the config file, same as every
other vhost. Add the hostname/service block **above** the catch-all
`http_status:404` rule:

```bash
sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.backup-$(date +%Y%m%d)
sudoedit /etc/cloudflared/config.yml
```

```yaml
ingress:
  # ... existing hostnames ...
  - hostname: social.vinnycapp.com
    service: http://localhost:3955
  # keep this last:
  - service: http_status:404
```

Register the DNS CNAME (by tunnel **name**) and restart:

```bash
cloudflared tunnel route dns dell-ssh social.vinnycapp.com
sudo systemctl restart cloudflared
```

(If `route dns` says the record already exists, that's fine — just restart.)

## 4. Cloudflare Access (the auth gate — dashboard)

The Access **application** is the *only* part that belongs in the dashboard. It must
target the **public hostname only** — do **not** add a private/`localhost:3955`
destination (that's the tunnel's job, done in step 3).

1. Zero Trust → **Access controls → Applications → Add an application → Self-hosted**
2. Public hostname: `social.vinnycapp.com`
3. Policy — Action **Allow**, Rule → Include → **Emails**:
   - `vinny@happilyrunning.com`
   - `me@vinnycapp.com`
   - `nichole@happilyrunning.com`
4. Save. The app's destinations should be just:
   ```json
   "destinations": [ { "type": "public", "uri": "social.vinnycapp.com", "zone_name": "vinnycapp.com" } ]
   ```

## 5. First real post, then go live

1. With `HR_SOCIAL_DRY_RUN=1`, attach an image to one draft, approve it, watch it
   "fire" in the activity log (no real API call).
2. Set `HR_SOCIAL_DRY_RUN=0` in `.env`, then `pm2 restart hr-social --update-env`.
3. Walk one real post through approve → fire and confirm it lands before drafting a
   full week.

## Updating later

```bash
cd /home/vin/hr-social
cp hr-social.mjs hr-social.mjs.bak-$(date +%Y%m%d)   # backup before overwrite
# pull/copy the new files, then:
npm install --omit=dev
pm2 restart hr-social --update-env
```

---

## Append to `dell-server-reference.md` (matches the existing entry format)

```md
### hr-social — Happily Running social publisher (added 2026-06-06)
Drafts/approves/schedules and posts to Instagram & Facebook with a two-switch
(approval + pause) safety model.
- Service: social.vinnycapp.com (port 3955, PM2 'hr-social', /home/vin/hr-social/hr-social.mjs)
- Stack: Node (ESM, no framework), atomic JSON store, one dep @anthropic-ai/sdk (drafting only)
- Architecture: single hr-social.mjs = HTTP server + 60s cron + Meta Graph publishing;
  dashboard.html served at /; state in hr-social.data.json (gitignored)
- Safety: posts fire only when approved && !paused && due && !posted; edits revert
  approval; no-image drafts can't be approved; missed/failed surface loudly; manual Retry
- Endpoints: / (dashboard), /health, /api/posts, /api/draft,
  /api/posts/:id/{approve,unapprove,pause,unpause,retry,post-now}
- Env: ANTHROPIC_API_KEY, HR_SOCIAL_ACCOUNTS (JSON), HR_TOKEN_<KEY> (Graph token),
  HR_SOCIAL_DRY_RUN; loaded via --node-args="--env-file=.env"
- Tunnel: hostname social.vinnycapp.com → http://localhost:3955 in /etc/cloudflared/config.yml
  (route: cloudflared tunnel route dns dell-ssh social.vinnycapp.com)
- Access: Zero Trust self-hosted app on social.vinnycapp.com — allow
  vinny@happilyrunning.com, me@vinnycapp.com, nichole@happilyrunning.com
- Deploy: pm2 start hr-social.mjs --name hr-social --node-args="--env-file=.env" && pm2 save
```

Add the row to the hostname→port table:

```md
| social.vinnycapp.com | http://localhost:3955 | HR Social (publisher) |
```
