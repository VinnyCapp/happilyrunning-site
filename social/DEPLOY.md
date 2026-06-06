# Deploying hr-social on the Dell

Run these **on the Dell** (Ubuntu 24.04, `192.168.68.103`). Tunnel ID is
`e60d22e1-4262-4b16-a0b3-d8d03aa839da` (the existing `vinnycapp.com` tunnel).

End state: `https://social.vinnycapp.com` → Cloudflare Access login → dashboard,
served from `localhost:3955`.

---

## 1. Install + configure env

```bash
cd ~/path/to/happilyrunning-site/social   # wherever the repo lives on the Dell
npm install --omit=dev

cp .env.example .env
nano .env                                  # fill in the values below
```

In `.env` set at minimum:

```ini
ANTHROPIC_API_KEY=sk-ant-...
HR_SOCIAL_ACCOUNTS=[{"key":"happilyrunning","name":"Happily Running","ig_user_id":"<IG_USER_ID>","fb_page_id":"<PAGE_ID>","token_env":"HR_TOKEN_HAPPILYRUNNING","platforms":["instagram","facebook"]}]
HR_TOKEN_HAPPILYRUNNING=<long-lived Graph token>
# Start safe — flip to 0 after the first real walk-through:
HR_SOCIAL_DRY_RUN=1
```

> Keep `HR_SOCIAL_HOST=127.0.0.1` (the default). The app must stay on localhost —
> Cloudflare Access is the only auth gate.

## 2. Start under PM2

Node 22 loads the `.env` natively via `--env-file`, so secrets stay out of PM2's
saved process list:

```bash
# back up any existing build first (infra rule)
cp hr-social.mjs hr-social.mjs.bak-$(date +%Y%m%d) 2>/dev/null || true

pm2 start hr-social.mjs --name hr-social --node-args="--env-file=.env"
pm2 save
pm2 logs hr-social --lines 20      # expect: "listening on http://127.0.0.1:3955 [DRY RUN]"
```

Quick local check (still on the Dell):

```bash
curl -s http://127.0.0.1:3955/health | head -c 300
```

## 3. Cloudflare Tunnel route

Add an ingress rule to the cloudflared config (usually
`/etc/cloudflared/config.yml` or `~/.cloudflared/config.yml`). It belongs **above**
the catch-all `service: http_status:404` rule:

```yaml
ingress:
  # ... existing hostnames ...
  - hostname: social.vinnycapp.com
    service: http://localhost:3955
  # keep this last:
  - service: http_status:404
```

Create the DNS record for the tunnel and restart:

```bash
cloudflared tunnel route dns e60d22e1-4262-4b16-a0b3-d8d03aa839da social.vinnycapp.com
sudo systemctl restart cloudflared
```

(If `route dns` says the record already exists, that's fine — just restart.)

## 4. Cloudflare Access (the auth gate)

Access apps are configured in the **Zero Trust dashboard** (or API/Terraform), not
in `config.yml`. Current dashboard nav:

1. Zero Trust → **Access controls → Applications → Add an application → Self-hosted**
2. Application (public hostname): `social.vinnycapp.com`
3. Add a policy — Action **Allow**, Session duration to taste, Rule → Include →
   **Emails**:
   - `vinny@happilyrunning.com`
   - `me@vinnycapp.com`
   - `nichole@happilyrunning.com`
4. Save.

> Tip: you can instead build the policy once under **Access controls → Policies**
> and reuse it across apps. `cloudflared tunnel route dns` only creates the DNS
> CNAME — it does **not** create the Access app, so this step is required for auth.

Now visit `https://social.vinnycapp.com` from anywhere — you'll get the Access
login, then the dashboard.

## 5. First real post, then go live

1. With `HR_SOCIAL_DRY_RUN=1`, attach an image to one draft, approve it, and watch
   it "fire" in the activity log (no real API call).
2. Set `HR_SOCIAL_DRY_RUN=0` in `.env`, then:
   ```bash
   pm2 restart hr-social --update-env
   ```
3. Walk one real post through approve → fire and confirm it lands on the account
   before drafting a full week.

## Updating later

```bash
git pull
cp hr-social.mjs hr-social.mjs.bak-$(date +%Y%m%d) 2>/dev/null || true   # backup before overwrite
npm install --omit=dev
pm2 restart hr-social --update-env
```

---

## Paste into `dell-server-reference.md`

```md
### hr-social — Happily Running social publisher
- Port: 3955 (binds 127.0.0.1)
- Domain: https://social.vinnycapp.com
- PM2 name: hr-social  (start: pm2 start hr-social.mjs --name hr-social --node-args="--env-file=.env")
- Tunnel: e60d22e1-4262-4b16-a0b3-d8d03aa839da — ingress social.vinnycapp.com → http://localhost:3955
- Cloudflare Access: app on social.vinnycapp.com, allow vinny@happilyrunning.com, me@vinnycapp.com, nichole@happilyrunning.com
- Code/data: <repo>/social/  (state in social/hr-social.data.json — not in git)
- Health: https://social.vinnycapp.com/health
```
