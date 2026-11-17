#!/usr/bin/env node
/**
 * build-site.js v1.0 — regenerates the build-managed parts of the static site.
 *
 *   node scripts/build-site.js                    # build for today (America/New_York)
 *   node scripts/build-site.js --today=2027-05-01 # pretend it's another day (testing)
 *   node scripts/build-site.js --check            # exit 1 if any file would change
 *
 * Everything it writes lives between <!-- BUILD:NAME:START --> / <!-- BUILD:NAME:END -->
 * markers, so hand edits outside the markers are never touched. No dependencies
 * (Node 18+). Output is plain static HTML.
 *
 *   RACES          race cards on / and /races/ from data/races.json (date-aware)
 *   EVENTS-JSONLD  Event JSON-LD for every future race (/ and /races/)
 *   TIMING-JSONLD  Organization + 3 Service + FAQPage on /timing/ (FAQ parsed
 *                  from the visible #faq section, so the two always match)
 *   PRICE-FLOOR    optional pricing line on /timing/ (scripts/site.config.json)
 *   STAMP          "site vX - DATE" in every page footer
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'site.config.json'), 'utf8'));
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'races.json'), 'utf8'));
const SITE = CONFIG.SITE_URL.replace(/\/$/, '');
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const todayArg = (args.find(a => a.startsWith('--today=')) || '').split('=')[1];

// Today's date in Eastern time, as YYYY-MM-DD (cron may run in UTC).
function easternToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return parts; // en-CA formats as YYYY-MM-DD
}
const TODAY = todayArg || easternToday();
if (!/^\d{4}-\d{2}-\d{2}$/.test(TODAY)) { console.error('bad --today'); process.exit(2); }

// ———— helpers ————
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
function fmtRange(start, end) {
  if (!end || end === start) return fmtDate(start);
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = end.split('-').map(Number);
  if (y1 === y2 && m1 === m2) return `${MONTHS[m1 - 1]} ${d1}–${d2}, ${y1}`;
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}
const jsonld = obj => '<script type="application/ld+json">\n' +
  JSON.stringify(obj, null, 2).replace(/</g, '\\u003c') + '\n</script>';

function replaceBlock(html, name, content, file) {
  const re = new RegExp(`(<!-- BUILD:${name}:START -->)[\\s\\S]*?(<!-- BUILD:${name}:END -->)`);
  if (!re.test(html)) throw new Error(`${file}: missing BUILD:${name} markers`);
  const inline = name === 'STAMP';
  return html.replace(re, (_, a, b) => inline ? `${a}${content}${b}` : `${a}\n${content}${content ? '\n' : ''}${b}`);
}

// ———— race state ————
const races = Object.values(DATA.races).filter(r => r.slug);
function raceState(r) {
  if (!r.date_iso) return 'tba';
  const last = r.date_end_iso || r.date_iso;
  return last < TODAY ? 'past' : 'future';
}
function regStatus(r) {
  if (r.registration_url && (!r.registration_opens || r.registration_opens <= TODAY)) {
    return { cls: 'is-open', text: 'Registration open' };
  }
  if (r.registration_opens && r.registration_opens > TODAY) {
    return { cls: 'is-upcoming', text: `Registration opens ${fmtDate(r.registration_opens)}` };
  }
  return { cls: 'is-upcoming', text: 'Registration opening soon' };
}

// UltraSignup results live at the same date id as registration, so derive the
// link when races.json doesn't give one explicitly.
function resultsUrl(r) {
  if (r.results_url) return r.results_url;
  const m = /ultrasignup\.com\/register\.aspx\?did=(\d+)/i.exec(r.registration_url || '');
  return m ? `https://ultrasignup.com/results_event.aspx?did=${m[1]}` : null;
}

function card(r) {
  const state = raceState(r);
  const href = `/races/${r.slug}.html`;
  const where = r.location && r.location !== 'TBA' ? ` · ${esc(r.location)}` : '';
  const dateText = r.date_iso ? fmtRange(r.date_iso, r.date_end_iso) : (r.date_short || 'Date TBA');
  const top = [
    `    <div class="race-card-date">${esc(dateText)}${where}</div>`,
  ];
  const mid = [
    `    <div class="race-card-location">${esc(r.tagline || '')}</div>`,
    `    <div class="race-card-distances">${esc(r.distances_display || '')}</div>`,
  ];

  if (state === 'past') {
    const year = (r.date_end_iso || r.date_iso).slice(0, 4);
    const next = r.next_edition && r.next_edition.date_iso
      ? `Next: ${fmtDate(r.next_edition.date_iso)}`
      : `${Number(year) + 1} date TBA`;
    const rurl = resultsUrl(r);
    const results = rurl
      ? `<a class="race-card-status is-closed" href="${esc(rurl)}" target="_blank" rel="noopener"><span class="dot"></span>${year} results →</a>`
      : `<span class="race-card-status is-closed"><span class="dot"></span>${year} race complete</span>`;
    return [
      `  <div class="race-card is-past" data-race="${esc(r.slug)}" data-date="${esc(r.date_iso)}">`,
      ...top,
      `    <h3 class="race-card-name"><a href="${href}">${esc(r.name)}</a></h3>`,
      ...mid,
      `    ${results}`,
      `    <div class="race-card-links"><span class="next">${esc(next)}</span><a href="${href}">Race info →</a></div>`,
      `  </div>`,
    ].join('\n');
  }

  const st = state === 'tba' ? { cls: 'is-upcoming', text: 'Date TBA' } : regStatus(r);
  return [
    `  <a href="${href}" class="race-card" data-race="${esc(r.slug)}"${r.date_iso ? ` data-date="${esc(r.date_iso)}"` : ''}>`,
    ...top,
    `    <h3 class="race-card-name">${esc(r.name)}</h3>`,
    ...mid,
    `    <span class="race-card-status ${st.cls}"><span class="dot"></span>${esc(st.text)}</span>`,
    `  </a>`,
  ].join('\n');
}

function raceCards() {
  const future = races.filter(r => raceState(r) === 'future').sort((a, b) => a.date_iso.localeCompare(b.date_iso));
  const tba = races.filter(r => raceState(r) === 'tba');
  const past = races.filter(r => raceState(r) === 'past').sort((a, b) => b.date_iso.localeCompare(a.date_iso));
  return [...future, ...tba, ...past].map(card).join('\n\n');
}

function eventsJsonld() {
  const future = races.filter(r => raceState(r) === 'future');
  if (!future.length) return '';
  const events = future.map(r => {
    const [locality, region] = (r.location || '').split(',').map(s => s.trim());
    const ev = {
      '@type': 'SportsEvent',
      name: r.name,
      sport: 'Running',
      startDate: r.date_iso,
      endDate: r.date_end_iso || r.date_iso,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      url: `${SITE}/races/${r.slug}`,
      description: `${r.tagline || ''} Distances: ${(r.distances || []).join(', ')}.`.trim(),
      location: {
        '@type': 'Place',
        name: r.location,
        address: { '@type': 'PostalAddress', addressLocality: locality, addressRegion: region, addressCountry: 'US' },
      },
      organizer: { '@type': 'Organization', name: 'Happily Running', url: SITE },
    };
    if (r.image) ev.image = [`${SITE}${r.image}`];
    const st = regStatus(r);
    if (r.registration_url) {
      ev.offers = {
        '@type': 'Offer',
        url: r.registration_url,
        availability: st.cls === 'is-open' ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
        priceCurrency: 'USD',
      };
      if (r.pricing && r.pricing.from) ev.offers.price = r.pricing.from;
      if (r.registration_opens) ev.offers.validFrom = r.registration_opens;
    }
    return ev;
  });
  return jsonld({ '@context': 'https://schema.org', '@graph': events });
}

// ———— /timing/ ————
const stripTags = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'")
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

function timingJsonld(html) {
  const faqSection = (html.match(/<section[^>]*id="faq"[\s\S]*?<\/section>/) || [''])[0];
  const faqs = [];
  const re = /<div class="faq-item">\s*<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/g;
  let m;
  while ((m = re.exec(faqSection))) faqs.push({ q: stripTags(m[1]), a: stripTags(m[2]) });
  if (faqs.length !== 7) throw new Error(`timing: expected 7 FAQ items, found ${faqs.length}`);

  const ORG = `${SITE}/#organization`;
  const areaServed = [
    ...['New York', 'New Jersey', 'Pennsylvania', 'Connecticut'].map(n => ({ '@type': 'State', name: n })),
    { '@type': 'Country', name: 'United States' },
  ];
  const svc = (id, name, serviceType, description) => ({
    '@type': 'Service', '@id': `${SITE}/timing/#${id}`, name, serviceType, description,
    provider: { '@id': ORG }, areaServed, url: `${SITE}/timing/#${id}`,
  });
  return jsonld({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization', '@id': ORG, name: 'Happily Running', url: `${SITE}/`,
        logo: `${SITE}/assets/img/brand/hr-logo-lockup-stacked.svg`,
        description: 'Happily Running is a family-run race timing, event production and consulting company based in Dryden, NY, timing road, trail and ultra events from 5K to 150 miles.',
        email: 'services@happilyrunning.com',
        address: { '@type': 'PostalAddress', addressLocality: 'Dryden', addressRegion: 'NY', postalCode: '13068', addressCountry: 'US' },
        areaServed,
        sameAs: ['https://instagram.com/happilyrunning', 'https://facebook.com/happilyrunning'],
      },
      svc('race-timing', 'Race timing', 'Race timing',
        'RFID chip timing, printed bibs, readers and mats, live results, integration with any registration platform, and custom timing software for road, trail and ultra events from 5K to 150 miles.'),
      svc('event-production', 'Event production', 'Event production',
        'Planning and running road, trail and ultra races: course, permits, start/finish, aid stations, staffing, packet pickup, awards and close-out.'),
      svc('consulting', 'Race director consulting', 'Consulting',
        'Consulting for race directors on timing setup, registration, course planning and race-day operations.'),
      {
        '@type': 'FAQPage', '@id': `${SITE}/timing/#faq`,
        mainEntity: faqs.map(f => ({
          '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  });
}

function priceFloor() {
  const v = CONFIG.PRICE_FLOOR;
  if (v === null || v === undefined || String(v).trim() === '') return '';
  return `    <p>Small local 5Ks typically start around ${esc(v)}.</p>`;
}

// ———— run ————
const stamp = `<p class="build-stamp">site v${esc(CONFIG.SITE_VERSION)} - ${esc(CONFIG.SITE_RELEASE_DATE)}</p>`;
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (rel === 'assets/partials.html') continue;
  const before = fs.readFileSync(file, 'utf8');
  let html = before;
  if (html.includes('<!-- BUILD:STAMP:START -->')) html = replaceBlock(html, 'STAMP', stamp, rel);
  if (html.includes('<!-- BUILD:RACES:START -->')) html = replaceBlock(html, 'RACES', raceCards(), rel);
  if (html.includes('<!-- BUILD:EVENTS-JSONLD:START -->')) html = replaceBlock(html, 'EVENTS-JSONLD', eventsJsonld(), rel);
  if (html.includes('<!-- BUILD:TIMING-JSONLD:START -->')) html = replaceBlock(html, 'TIMING-JSONLD', timingJsonld(html), rel);
  if (html.includes('<!-- BUILD:PRICE-FLOOR:START -->')) html = replaceBlock(html, 'PRICE-FLOOR', priceFloor(), rel);
  if (html !== before) {
    changed++;
    if (CHECK) console.log(`would change: ${rel}`);
    else { fs.writeFileSync(file, html); console.log(`built: ${rel}`); }
  }
}
console.log(`build-site v1.0 · today=${TODAY} · ${changed} file(s) ${CHECK ? 'out of date' : 'updated'}`);
if (CHECK && changed) process.exit(1);
