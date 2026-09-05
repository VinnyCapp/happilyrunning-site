# hr-social — Dell handoff brief

Paste this whole file (or just point Claude Code at it) in a **Claude Code session
running on the Dell**. That session has a real shell on the box, so it can do the
parts the web session cannot: edit `/etc/cloudflared/config.yml`, run `pm2`, and
restart `cloudflared`.

> Run it in tmux so it survives disconnects: `tmux new -s social` → `claude`.
> Enable Remote Control to drive it from the Pixel.

---

## Goal

Deploy `hr-social` (the Instagram/Facebook publisher with the approval/pause safety
model) to `https://social.vinnycapp.com`, served from `localhost:3955`, gated by
Cloudflare Access. Start in DRY RUN, then walk one real post before going live.

## Context (from dell-server-reference.md)

- Apps live in `/home/vin/<name>/`, run under PM2 (`pm2-vin.service` → `pm2 resurrect`).
  **Always `pm2 save` after adding a service** or it won't survive reboot.
- Tunnel is **locally-managed**: tunnel name `dell-ssh`, config at
  `/etc/cloudflared/config.yml`, cloudflared runs as a systemd unit. Routing is done
  in the config file (NOT the dashboard). New hostnames:
  `cloudflared tunnel route dns dell-ssh <host>` + a block above the
  `http_status:404` catch-all + `sudo systemctl restart cloudflared`.
- Port **3955** is free (waterline is 3953/uploader).
- Image pipeline already exists: `upload.vinnycapp.com` → `/home/vin/web/uploads/`
  → served at `static.vinnycapp.com/uploads/`. The drafter leaves images blank;
  a human pastes a `static.vinnycapp.com/uploads/…` URL before approving.

## Repo

- GitHub: `https://github.com/VinnyCapp/happilyrunning-site.git`
- Branch: `claude/meta-publishing-approval-PpfWL`
- Tool lives in `social/`.

---

## Steps

### 1. Get the code into its own service dir

```bash
cd /home/vin
git clone https://github.com/VinnyCapp/happilyrunning-site.git hr-social-src 2>/dev/null \
  || (cd hr-social-src && git fetch origin)
cd hr-social-src
git checkout claude/meta-publishing-approval-PpfWL
git pull origin claude/meta-publishing-approval-PpfWL

mkdir -p /home/vin/hr-social
cp -r /home/vin/hr-social-src/social/. /home/vin/hr-social/
cd /home/vin/hr-social
npm install --omit=dev
node --check hr-social.mjs && echo "syntax OK"
```

### 2. Configure env (start in DRY RUN)

```bash
cp .env.example .env
```

Edit `.env` and set:

```ini
ANTHROPIC_API_KEY=sk-ant-...
HR_SOCIAL_ACCOUNTS=[{"key":"happilyrunning","name":"Happily Running","ig_user_id":"<IG_USER_ID>","fb_page_id":"<PAGE_ID>","token_env":"HR_TOKEN_HAPPILYRUNNING","platforms":["instagram","facebook"]}]
HR_TOKEN_HAPPILYRUNNING=<long-lived Graph token>
HR_SOCIAL_DRY_RUN=1
```

> Need the IG user ID / Page ID for the token? Ask Claude here to run the Graph
> `/me/accounts` + `instagram_business_account` lookup with the token.

### 3. Start under PM2 (and SAVE)

```bash
cd /home/vin/hr-social
# if the Dell's node predates v20.6 (check: node -v), use:  set -a; . ./.env; set +a; pm2 start hr-social.mjs --name hr-social
pm2 start hr-social.mjs --name hr-social --node-args="--env-file=.env"
pm2 save
pm2 logs hr-social --lines 20      # expect: "listening on http://127.0.0.1:3955 [DRY RUN]"
curl -s http://127.0.0.1:3955/health | head -c 300; echo
```

### 4. Add the tunnel route (config.yml — verify before restart)

```bash
sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.backup-$(date +%Y%m%d)

# insert the social block just above the catch-all
sudo sed -i '/service: http_status:404/i\  - hostname: social.vinnycapp.com\n    service: http://localhost:3955' /etc/cloudflared/config.yml

grep -B1 -A1 'social.vinnycapp.com' /etc/cloudflared/config.yml   # confirm 2-space indent
cloudflared tunnel ingress validate                               # MUST pass — if not, restore backup

cloudflared tunnel route dns dell-ssh social.vinnycapp.com
sudo systemctl restart cloudflared
```

Expected block:
```yaml
  - hostname: social.vinnycapp.com
    service: http://localhost:3955
```

### 5. Cloudflare Access (dashboard — already mostly done)

The Access app for `social.vinnycapp.com` exists with policy `e00eae7a-…` allowing
`vinny@happilyrunning.com`, `me@vinnycapp.com`, `nichole@happilyrunning.com`.
**One cleanup:** remove the stray `private` / `localhost:3955` destination from the
app — it should target the public hostname only:

```json
"destinations": [ { "type": "public", "uri": "social.vinnycapp.com", "zone_name": "vinnycapp.com" } ]
```

### 6. Verify end to end

```bash
# from anywhere with internet:
curl -sS -I -L https://social.vinnycapp.com/health
```
- 302 → `…cloudflareaccess.com/…` login = ✅ working (sign in, you'll see the dashboard).
- 502 = app not listening (check `pm2 logs hr-social`).
- 1033 = cloudflared didn't reload (`sudo systemctl restart cloudflared`).
- JSON with no login = Access not gating (re-attach policy to the hostname).

### 7. First real post, then go live

1. In the dashboard (DRY RUN on): add a `static.vinnycapp.com/uploads/…` image to one
   draft, Approve, and watch it "fire" in the activity log (no real API call).
2. `nano .env` → `HR_SOCIAL_DRY_RUN=0`, then `pm2 restart hr-social --update-env`.
3. Approve one real post, watch it land on the account, **then** use "Draft a week".

### 8. Record the infra change

Append the `hr-social` entry + hostname→port row to
`/home/vin/dell-server-reference.md` — the exact block is at the bottom of
`social/DEPLOY.md`.

---

## If something's off

- `pm2 logs hr-social` — app errors (bad token, account config).
- `sudo journalctl -u cloudflared -n 50` — tunnel errors.
- The full reference + API list is in `social/README.md`; deploy detail in
  `social/DEPLOY.md`.
