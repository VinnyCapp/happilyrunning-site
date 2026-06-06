# hr-social — Happily Running social publisher

A single Node service that drafts, reviews, schedules, and posts to Instagram and
Facebook with a deliberate **two-switch safety model**. No framework, one npm
dependency (`@anthropic-ai/sdk`, used only for drafting). State lives in a local
JSON file written atomically.

- **Port:** `3955` · **Domain:** `social.vinnycapp.com` · **PM2 name:** `hr-social`
- Version string shows in the dashboard footer and at `/health`.

## The safety model (why this exists)

A post fires **only** when all four are true:

```
approved == true  AND  paused == false  AND  now >= scheduled_at  AND  not already posted
```

Two independent switches plus a schedule:

- **Approval** and **pause** are separate. Pause freezes a post without losing its approval.
- **Editing an approved post auto-reverts approval** — changed content can't ride an old "yes".
- **A draft with no image cannot be approved.**
- A post that reaches its scheduled time while unapproved or paused becomes
  **"missed"** and is surfaced loudly (dashboard + logs). It never silently posts
  and never silently disappears.
- The cron **ticks every 60s, fails loud, and never blind-retries.** A failed post
  stays failed until you hit **Retry** (which clears the failure so it can refire).

## Run locally

```bash
cd social
npm install
cp .env.example .env   # fill in accounts + tokens (see below)
npm start              # http://127.0.0.1:3955
```

`npm run check` syntax-checks the server without starting it.

### First real post (do this before trusting a batch)

1. Start with `HR_SOCIAL_DRY_RUN=1` and walk one post through approve → watch it
   "fire" in the activity log (no real API call).
2. Flip `HR_SOCIAL_DRY_RUN=0`, attach a real `static.vinnycapp.com` image, approve
   one post, and watch it actually publish before drafting a full week.

## Configuration (env)

| Var | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Required for "Draft a week" only. |
| `HR_SOCIAL_MODEL` | `claude-opus-4-8` | Drafting model. |
| `HR_SOCIAL_HOST` | `127.0.0.1` | Bind host — keep local so only the tunnel reaches it. |
| `HR_SOCIAL_PORT` | `3955` | Bind port. |
| `HR_SOCIAL_POST_HOUR` | `17` | Local hour drafts are scheduled at. |
| `HR_GRAPH_VERSION` | `v21.0` | Graph API version. |
| `HR_SOCIAL_DRY_RUN` | `0` | `1` = simulate posting (no Graph call). |
| `HR_SOCIAL_ACCOUNTS` | seed | JSON array of accounts (see `.env.example`). |
| `HR_TOKEN_<KEY>` | — | Graph token, referenced by each account's `token_env`. |

Tokens are read from env at post time and **never** stored in the accounts JSON or
the data file.

## Publishing pipeline

Images must already be at a public URL — we reuse the existing
`upload.vinnycapp.com → static.vinnycapp.com/uploads/` pipeline, so the IG
"public URL first" requirement is a non-issue. The drafter leaves the image blank
by design; a human attaches the URL before approving.

- **Instagram (single):** `POST /{ig_id}/media` → `creation_id` → `POST /{ig_id}/media_publish`.
- **Instagram carousel:** each image as a child (`is_carousel_item=true`) → parent
  container (`media_type=CAROUSEL`, `children=…`) → publish. Children should be JPEG.
  (Add more than one image URL to a post to trigger carousel mode.)
- **Facebook Page:** `POST /{page_id}/photos` (`url`, `caption`).

All calls are POST. (The Graph API Explorer defaults to GET — GET on `/media`
*lists* posts instead of creating one.)

## Deploy on the Dell

Full step-by-step (PM2 + Cloudflare tunnel route + Access) is in **[DEPLOY.md](./DEPLOY.md)**.
Short version:

```bash
# back up the current build before overwriting
cp hr-social.mjs hr-social.mjs.bak-$(date +%Y%m%d) 2>/dev/null || true
npm install --omit=dev
pm2 start hr-social.mjs --name hr-social --node-args="--env-file=.env"
pm2 save
```

### Standing infra reminders (infra-change rule)

- **dell-server-reference.md:** add the `hr-social` entry — port 3955,
  `social.vinnycapp.com`, PM2 name `hr-social`, tunnel route, Cloudflare Access entry.
- **Cloudflare Tunnel (locally-managed):** add the ingress block to
  `/etc/cloudflared/config.yml` and run
  `cloudflared tunnel route dns dell-ssh social.vinnycapp.com` — routing is **not**
  done in the dashboard. See [DEPLOY.md](./DEPLOY.md).
- **Cloudflare Access:** add `social.vinnycapp.com` (allowed:
  `vinny@happilyrunning.com`, `me@vinnycapp.com`, `nichole@happilyrunning.com`).
  Access is the only auth gate — the app binds to localhost and trusts the tunnel.
- **Backup before overwrite** (the deploy snippet above does this).

## API (the dashboard is just a client of this)

| Method | Path | |
| --- | --- | --- |
| GET | `/` | Dashboard |
| GET | `/health` | Version, counts, account/token status |
| GET | `/api/posts[?account=]` | List posts (with derived status) |
| POST | `/api/posts` | Create a blank/manual post |
| POST | `/api/draft` | Generate a week of drafts `{account, theme?, count?}` |
| PATCH | `/api/posts/:id` | Edit caption/images/schedule (reverts approval) |
| POST | `/api/posts/:id/approve` · `/unapprove` · `/pause` · `/unpause` · `/retry` · `/post-now` | Switches |
| DELETE | `/api/posts/:id` | Delete |
| GET | `/api/events` | Recent activity log |

## Roadmap (per the brief)

- **FB Page posting:** goes live once `pages_manage_posts` clears (token already
  covers it) — no code change needed.
- **More brands:** add an account to `HR_SOCIAL_ACCOUNTS` + its token env.
- **Stories / Reels:** Stories can't get link stickers via API (stays manual);
  Reels need video (later).
- **Auto-image suggestion / Cortex (Signal) approval:** later.
