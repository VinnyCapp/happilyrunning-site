// hr-social.mjs — Happily Running social publisher
// Single-file Node service. Draft → review → approve → schedule → post
// to Instagram / Facebook, with a two-switch (approval + pause) safety model.
//
// Core safety rule (do not weaken):
//   A post fires ONLY when: approved && !paused && now >= scheduled_at && !posted
//   - Editing an approved post auto-reverts approval.
//   - Pause freezes a post without losing it.
//   - A post that hits its time while unapproved/paused becomes "missed" and is
//     surfaced LOUDLY. It never silently posts and never silently disappears.
//   - Cron ticks every 60s, fails loud, never blind-retries — manual Retry only.
//   - A draft with no image cannot be approved.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.1.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────
const HOST = process.env.HR_SOCIAL_HOST || '127.0.0.1';
const PORT = parseInt(process.env.HR_SOCIAL_PORT || '3955', 10);
const POST_HOUR = parseInt(process.env.HR_SOCIAL_POST_HOUR || '17', 10);
const GRAPH_VERSION = process.env.HR_GRAPH_VERSION || 'v21.0';
const GRAPH = 'https://graph.facebook.com/' + GRAPH_VERSION;
const DRY_RUN = process.env.HR_SOCIAL_DRY_RUN === '1';
const MODEL = process.env.HR_SOCIAL_MODEL || 'claude-opus-4-8';
const DATA_FILE = process.env.HR_SOCIAL_DATA || path.join(__dirname, 'hr-social.data.json');
const DASHBOARD = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');

function loadAccounts() {
  let accounts = [];
  if (process.env.HR_SOCIAL_ACCOUNTS) {
    try {
      accounts = JSON.parse(process.env.HR_SOCIAL_ACCOUNTS);
      if (!Array.isArray(accounts)) throw new Error('not an array');
    } catch (e) {
      console.error('[hr-social] HR_SOCIAL_ACCOUNTS is not valid JSON:', e.message);
      accounts = [];
    }
  }
  if (!accounts.length) {
    // Seed a placeholder so the dashboard loads. Posting will fail loud until
    // a real ig_user_id / fb_page_id / token is configured.
    accounts = [{
      key: 'happilyrunning',
      name: 'Happily Running',
      ig_user_id: '',
      fb_page_id: '',
      token_env: 'HR_TOKEN_HAPPILYRUNNING',
      platforms: ['instagram', 'facebook'],
    }];
  }
  return accounts;
}
const accounts = loadAccounts();

// ── Store (atomic JSON) ────────────────────────────────────────────────
let db = { posts: [], events: [], seq: 0 };
function load() {
  try {
    db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    db.posts ||= []; db.events ||= []; db.seq ||= 0;
  } catch {
    db = { posts: [], events: [], seq: 0 };
  }
}
function save() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}
function logEvent(level, msg) {
  const entry = { ts: new Date().toISOString(), level, msg };
  db.events.unshift(entry);
  if (db.events.length > 300) db.events.length = 300;
  const line = '[hr-social] ' + entry.ts + ' ' + level.toUpperCase() + ' ' + msg;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

// ── Status derivation ──────────────────────────────────────────────────
// Stored truth is minimal: approved, paused, posted (+terminal data), failed
// (+error). Everything a human reads is derived so it can never go stale.
function isDue(p, now) { return new Date(p.scheduled_at).getTime() <= now; }
function deriveStatus(p, now = Date.now()) {
  if (p.posted) return 'posted';
  if (p.failed) return 'failed';        // needs attention
  if (isDue(p, now) && (!p.approved || p.paused)) return 'missed'; // needs attention
  if (p.approved && !p.paused) return 'scheduled';
  return 'draft';
}
function needsAttention(s) { return s === 'failed' || s === 'missed'; }
function publicPost(p) {
  return { ...p, status: deriveStatus(p), needs_attention: needsAttention(deriveStatus(p)) };
}
function hasImage(p) { return Array.isArray(p.image_urls) && p.image_urls.filter(Boolean).length > 0; }
function findPost(id) { return db.posts.find(p => p.id === id); }
function findAccount(key) { return accounts.find(a => a.key === key); }

// ── Meta Graph API ─────────────────────────────────────────────────────
async function graph(endpoint, params) {
  const body = new URLSearchParams(params);
  let res, json;
  try {
    res = await fetch(GRAPH + endpoint, { method: 'POST', body });
    json = await res.json().catch(() => ({}));
  } catch (e) {
    throw new Error('Network error calling Graph API: ' + (e.message || e));
  }
  if (!res.ok || json.error) {
    const err = json.error || {};
    throw new Error('Graph API ' + (err.code || res.status) + ': ' + (err.message || res.statusText || 'unknown error'));
  }
  return json;
}
async function postInstagramSingle(acc, token, imageUrl, caption) {
  const c = await graph('/' + acc.ig_user_id + '/media', { image_url: imageUrl, caption, access_token: token });
  const p = await graph('/' + acc.ig_user_id + '/media_publish', { creation_id: c.id, access_token: token });
  return { platform: 'instagram', kind: 'single', creation_id: c.id, id: p.id };
}
async function postInstagramCarousel(acc, token, urls, caption) {
  const children = [];
  for (const u of urls) {
    const ch = await graph('/' + acc.ig_user_id + '/media', { image_url: u, is_carousel_item: 'true', access_token: token });
    children.push(ch.id);
  }
  const parent = await graph('/' + acc.ig_user_id + '/media', {
    media_type: 'CAROUSEL', children: children.join(','), caption, access_token: token,
  });
  const p = await graph('/' + acc.ig_user_id + '/media_publish', { creation_id: parent.id, access_token: token });
  return { platform: 'instagram', kind: 'carousel', children, creation_id: parent.id, id: p.id };
}
async function postFacebookPhoto(acc, token, imageUrl, caption) {
  const p = await graph('/' + acc.fb_page_id + '/photos', { url: imageUrl, caption, access_token: token });
  return { platform: 'facebook', kind: 'photo', id: p.id, post_id: p.post_id || null };
}
function tokenFor(acc) {
  if (DRY_RUN) return 'DRYRUN';
  if (acc.token) return acc.token;
  if (acc.token_env && process.env[acc.token_env]) return process.env[acc.token_env];
  return process.env['HR_TOKEN_' + acc.key.toUpperCase()] || null;
}
async function publishPost(p) {
  const acc = findAccount(p.account);
  if (!acc) throw new Error('Unknown account "' + p.account + '"');
  if (!hasImage(p)) throw new Error('No image attached');
  const urls = p.image_urls.filter(Boolean);
  const token = tokenFor(acc);
  if (!token) throw new Error('No access token for "' + acc.key + '" (set ' + (acc.token_env || ('HR_TOKEN_' + acc.key.toUpperCase())) + ')');

  if (DRY_RUN) return { dry_run: true, platform: p.platform, id: 'dryrun_' + p.id, urls };

  if (p.platform === 'facebook') {
    if (!acc.fb_page_id) throw new Error('Account "' + acc.key + '" has no fb_page_id');
    return postFacebookPhoto(acc, token, urls[0], p.caption);
  }
  if (!acc.ig_user_id) throw new Error('Account "' + acc.key + '" has no ig_user_id');
  if (urls.length > 1) return postInstagramCarousel(acc, token, urls, p.caption);
  return postInstagramSingle(acc, token, urls[0], p.caption);
}

// ── Cron tick (every 60s) ──────────────────────────────────────────────
let ticking = false;
async function tick() {
  if (ticking) return;            // never overlap
  ticking = true;
  try {
    const now = Date.now();
    // Surface newly-missed posts loudly (once each).
    for (const p of db.posts) {
      if (!p.posted && !p.failed && isDue(p, now) && (!p.approved || p.paused) && !p.missed_logged) {
        p.missed_logged = true;
        logEvent('warn', 'MISSED #' + p.id + ' (' + p.account + '/' + p.platform + ') — hit its time while ' +
          (!p.approved ? 'unapproved' : 'paused') + '. Needs attention.');
        save();
      }
    }
    // Fire everything that is genuinely cleared to go.
    const due = db.posts.filter(p => p.approved && !p.paused && !p.posted && !p.failed && isDue(p, now));
    for (const p of due) {
      try {
        logEvent('info', 'Firing #' + p.id + ' (' + p.account + '/' + p.platform + ')' + (DRY_RUN ? ' [DRY RUN]' : ''));
        const result = await publishPost(p);
        p.posted = true;
        p.posted_at = new Date().toISOString();
        p.result = result;
        p.error = null;
        p.updated_at = p.posted_at;
        logEvent('success', 'Posted #' + p.id + ' → ' + (result.id || 'ok'));
      } catch (e) {
        p.failed = true;            // loud + sticky; no blind retry
        p.attempts = (p.attempts || 0) + 1;
        p.error = String(e && e.message ? e.message : e);
        p.updated_at = new Date().toISOString();
        logEvent('error', 'FAILED #' + p.id + ' (attempt ' + p.attempts + '): ' + p.error);
      }
      save();
    }
  } catch (e) {
    logEvent('error', 'Cron tick crashed: ' + (e && e.message ? e.message : e));
  } finally {
    ticking = false;
  }
}

// ── Drafting (Claude) ──────────────────────────────────────────────────
function upcomingRaces() {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'races.json'), 'utf8'));
    return Object.values(data.races || {})
      .filter(r => r.status === 'open' || r.status === 'upcoming')
      .map(r => '- ' + r.name + ' (' + r.location + ', ' + r.date + ', ' + r.distances_display + ') — ' + r.status_text);
  } catch {
    return [];
  }
}
const DRAFT_SYSTEM = [
  'You write social captions for Happily Running, a trail and ultramarathon race company in New York and Pennsylvania.',
  '',
  'Voice: warm, encouraging, grounded in the trail-running community. Real and a little playful — never corporate, never hype-y, no buzzwords or fake urgency. Talk like a fellow runner who loves these woods, these races, and the people who show up for them. Celebrate effort over ego. First person plural ("we", "our") is fine.',
  '',
  'Rules:',
  '- Each caption stands alone and reads naturally on Instagram.',
  '- Keep captions tight: roughly 1–4 short sentences.',
  '- You may reference the real upcoming races listed by the user when relevant, but do not invent dates, prices, or facts.',
  '- Suggest 3–6 relevant hashtags per post (no spaces, no leading #; the tool adds the #). Favor running/trail/region tags.',
  '- Do NOT include image descriptions or "[photo]" placeholders — a human attaches the image.',
  '- Vary the angle across the batch: course/terrain, community, training motivation, volunteers, race-day logistics, post-race vibes, etc.',
].join('\n');

async function generateDrafts({ theme, count }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error('ANTHROPIC_API_KEY is not set — cannot draft.');
    err.statusCode = 400;
    throw err;
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const races = upcomingRaces();
  const userPrompt = [
    'Write ' + count + ' distinct Instagram captions for Happily Running' + (theme ? ', themed around: ' + theme : '') + '.',
    races.length ? '\nUpcoming races you can reference (use only what is true here):\n' + races.join('\n') : '',
    '\nReturn each as a caption plus suggested hashtags and a day_offset (an integer 1–7 suggesting how many days from now to post it).',
  ].join('\n');

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      posts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            caption: { type: 'string' },
            hashtags: { type: 'array', items: { type: 'string' } },
            day_offset: { type: 'integer' },
          },
          required: ['caption', 'hashtags', 'day_offset'],
        },
      },
    },
    required: ['posts'],
  };

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: DRAFT_SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
    output_config: { format: { type: 'json_schema', schema } },
  });
  const textBlock = resp.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('No text returned from the model');
  const parsed = JSON.parse(textBlock.text);
  return Array.isArray(parsed.posts) ? parsed.posts : [];
}

// Spread N posts across the next 7 days at POST_HOUR local time.
function scheduledAtFor(index, total, dayOffsetHint) {
  const now = new Date();
  let day = Number.isInteger(dayOffsetHint) ? dayOffsetHint : Math.round((index + 1) * 7 / (total + 1));
  day = Math.min(7, Math.max(1, day));
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, POST_HOUR, 0, 0, 0);
  if (d.getTime() <= now.getTime() + 3600_000) d.setTime(now.getTime() + 24 * 3600_000); // never in the past
  return d.toISOString();
}

function newPost(fields) {
  const nowIso = new Date().toISOString();
  return {
    id: ++db.seq,
    account: fields.account,
    platform: fields.platform || 'instagram',
    caption: fields.caption || '',
    image_urls: Array.isArray(fields.image_urls) ? fields.image_urls.filter(Boolean) : [],
    scheduled_at: fields.scheduled_at || scheduledAtFor(0, 1),
    theme: fields.theme || null,
    approved: false,
    paused: false,
    posted: false,
    failed: false,
    posted_at: null,
    result: null,
    error: null,
    attempts: 0,
    missed_logged: false,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

// ── HTTP helpers ───────────────────────────────────────────────────────
function send(res, code, obj, type) {
  const body = type === 'html' ? obj : JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': type === 'html' ? 'text/html; charset=utf-8' : 'application/json' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

// ── Router ─────────────────────────────────────────────────────────────
const ID_RE = /^\/api\/posts\/(\d+)(\/[a-z-]+)?$/;

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const method = req.method;

  if (p === '/' && method === 'GET') {
    return send(res, 200, DASHBOARD.replace(/__VERSION__/g, VERSION), 'html');
  }

  if (p === '/health' && method === 'GET') {
    const now = Date.now();
    const counts = { draft: 0, scheduled: 0, posted: 0, failed: 0, missed: 0 };
    for (const post of db.posts) counts[deriveStatus(post, now)]++;
    return send(res, 200, {
      status: 'ok', version: VERSION, now: new Date(now).toISOString(),
      dry_run: DRY_RUN, graph_version: GRAPH_VERSION, post_hour: POST_HOUR,
      accounts: accounts.map(a => ({ key: a.key, name: a.name, platforms: a.platforms || ['instagram'],
        ig_configured: !!a.ig_user_id, fb_configured: !!a.fb_page_id, token_configured: !!tokenFor(a) })),
      counts,
    });
  }

  if (p === '/api/accounts' && method === 'GET') {
    return send(res, 200, accounts.map(a => ({ key: a.key, name: a.name, platforms: a.platforms || ['instagram'] })));
  }

  if (p === '/api/events' && method === 'GET') {
    return send(res, 200, db.events.slice(0, 60));
  }

  if (p === '/api/posts' && method === 'GET') {
    const acc = url.searchParams.get('account');
    let list = db.posts.map(publicPost);
    if (acc) list = list.filter(x => x.account === acc);
    list.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    return send(res, 200, list);
  }

  if (p === '/api/posts' && method === 'POST') {
    const body = await readBody(req);
    if (!body.account || !findAccount(body.account)) return send(res, 400, { error: 'Unknown or missing account' });
    const post = newPost(body);
    db.posts.push(post);
    save();
    logEvent('info', 'Created draft #' + post.id + ' (' + post.account + '/' + post.platform + ')');
    return send(res, 201, publicPost(post));
  }

  if (p === '/api/draft' && method === 'POST') {
    const body = await readBody(req);
    if (!body.account || !findAccount(body.account)) return send(res, 400, { error: 'Unknown or missing account' });
    const count = Math.min(10, Math.max(1, parseInt(body.count || 5, 10)));
    let drafts;
    try {
      drafts = await generateDrafts({ theme: body.theme, count });
    } catch (e) {
      logEvent('error', 'Draft generation failed: ' + (e.message || e));
      return send(res, e.statusCode || 502, { error: 'Draft generation failed: ' + (e.message || e) });
    }
    const created = [];
    drafts.forEach((d, i) => {
      const tags = (d.hashtags || []).map(t => '#' + String(t).replace(/^#/, '').replace(/\s+/g, '')).join(' ');
      const caption = tags ? (d.caption + '\n\n' + tags) : d.caption;
      const post = newPost({
        account: body.account,
        platform: body.platform || 'instagram',
        caption,
        scheduled_at: scheduledAtFor(i, drafts.length, d.day_offset),
        theme: body.theme || null,
      });
      db.posts.push(post);
      created.push(post);
    });
    save();
    logEvent('success', 'Drafted ' + created.length + ' posts for ' + body.account + (body.theme ? ' (theme: ' + body.theme + ')' : ''));
    return send(res, 201, created.map(publicPost));
  }

  const m = p.match(ID_RE);
  if (m) {
    const id = parseInt(m[1], 10);
    const action = m[2];
    const post = findPost(id);
    if (!post) return send(res, 404, { error: 'No post #' + id });

    if (!action && method === 'PATCH') {
      const body = await readBody(req);
      const editable = ['caption', 'image_urls', 'scheduled_at', 'account', 'platform', 'theme'];
      let changed = false;
      for (const f of editable) {
        if (!(f in body)) continue;
        if (f === 'image_urls') post.image_urls = (Array.isArray(body.image_urls) ? body.image_urls : String(body.image_urls || '').split('\n')).map(s => s.trim()).filter(Boolean);
        else if (f === 'account' && !findAccount(body.account)) return send(res, 400, { error: 'Unknown account' });
        else post[f] = body[f];
        changed = true;
      }
      if (changed) {
        // Changed content can't ride an old "yes": revert approval, clear failure.
        if (post.approved) logEvent('info', 'Edit reverted approval on #' + post.id);
        post.approved = false;
        post.failed = false;
        post.error = null;
        post.missed_logged = false;
        post.updated_at = new Date().toISOString();
        save();
      }
      return send(res, 200, publicPost(post));
    }

    if (!action && method === 'DELETE') {
      db.posts = db.posts.filter(x => x.id !== id);
      save();
      logEvent('info', 'Deleted #' + id);
      return send(res, 200, { ok: true });
    }

    if (method === 'POST') {
      if (action === '/approve') {
        if (post.posted) return send(res, 409, { error: 'Already posted' });
        if (!hasImage(post)) return send(res, 400, { error: 'A draft with no image cannot be approved.' });
        post.approved = true; post.failed = false; post.error = null; post.missed_logged = false;
        post.updated_at = new Date().toISOString();
        save();
        logEvent('info', 'Approved #' + id);
        return send(res, 200, publicPost(post));
      }
      if (action === '/unapprove') {
        post.approved = false; post.updated_at = new Date().toISOString(); save();
        logEvent('info', 'Unapproved #' + id);
        return send(res, 200, publicPost(post));
      }
      if (action === '/pause') {
        post.paused = true; post.updated_at = new Date().toISOString(); save();
        logEvent('info', 'Paused #' + id);
        return send(res, 200, publicPost(post));
      }
      if (action === '/unpause') {
        post.paused = false; post.missed_logged = false; post.updated_at = new Date().toISOString(); save();
        logEvent('info', 'Unpaused #' + id);
        return send(res, 200, publicPost(post));
      }
      if (action === '/retry') {
        if (post.posted) return send(res, 409, { error: 'Already posted' });
        post.failed = false; post.error = null; post.missed_logged = false;
        post.updated_at = new Date().toISOString(); save();
        logEvent('info', 'Cleared failure on #' + id + ' — will refire when due.');
        return send(res, 200, publicPost(post));
      }
      if (action === '/post-now') {
        if (post.posted) return send(res, 409, { error: 'Already posted' });
        if (!post.approved || post.paused) return send(res, 400, { error: 'Approve and unpause before posting now.' });
        if (!hasImage(post)) return send(res, 400, { error: 'No image attached' });
        try {
          logEvent('info', 'Manual post-now #' + id + (DRY_RUN ? ' [DRY RUN]' : ''));
          const result = await publishPost(post);
          post.posted = true; post.posted_at = new Date().toISOString(); post.result = result;
          post.error = null; post.failed = false; post.updated_at = post.posted_at; save();
          logEvent('success', 'Posted #' + id + ' → ' + (result.id || 'ok'));
          return send(res, 200, publicPost(post));
        } catch (e) {
          post.failed = true; post.attempts = (post.attempts || 0) + 1;
          post.error = String(e.message || e); post.updated_at = new Date().toISOString(); save();
          logEvent('error', 'Manual post-now FAILED #' + id + ': ' + post.error);
          return send(res, 502, { error: post.error });
        }
      }
    }
  }

  return send(res, 404, { error: 'Not found' });
}

// ── Boot ───────────────────────────────────────────────────────────────
load();
const server = http.createServer((req, res) => {
  route(req, res).catch(e => {
    logEvent('error', 'Request error ' + req.method + ' ' + req.url + ': ' + (e.message || e));
    if (!res.headersSent) send(res, e.message === 'Invalid JSON body' ? 400 : 500, { error: e.message || 'Server error' });
  });
});
server.listen(PORT, HOST, () => {
  logEvent('info', 'hr-social v' + VERSION + ' listening on http://' + HOST + ':' + PORT +
    (DRY_RUN ? ' [DRY RUN]' : '') + ' — accounts: ' + accounts.map(a => a.key).join(', '));
  tick();
});
setInterval(tick, 60_000);
