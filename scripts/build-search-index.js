#!/usr/bin/env node
/**
 * build-search-index.js
 * Walks site HTML files, extracts searchable content blocks,
 * writes data/search-index.json
 *
 * Run: node scripts/build-search-index.js
 * from the site root.
 */

const fs = require('fs');
const path = require('path');

const SITE_ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(SITE_ROOT, 'data', 'search-index.json');

// Race slug → display label mapping
const RACE_LABELS = {
  'shore2shore':  'Shore2Shore',
  'virgilcrest':  'Virgil Crest',
  'teslahertz':   'Tesla Hertz',
  'watergap':     'Water Gap',
  'greekpeak':    'Greek Peak',
  'racetheghost': 'Race the Ghost',
};

// Pages to index: [ file path relative to site root, source_label, source_url, race_slug or null ]
const PAGES = [
  // Race pages
  { file: 'races/shore2shore.html',  label: 'Shore2Shore',    url: '/races/shore2shore',  slug: 'shore2shore'  },
  { file: 'races/virgilcrest.html',  label: 'Virgil Crest',   url: '/races/virgilcrest',  slug: 'virgilcrest'  },
  { file: 'races/teslahertz.html',   label: 'Tesla Hertz',    url: '/races/teslahertz',   slug: 'teslahertz'   },
  { file: 'races/watergap.html',     label: 'Water Gap',      url: '/races/watergap',     slug: 'watergap'     },
  { file: 'races/greekpeak.html',    label: 'Greek Peak',     url: '/races/greekpeak',    slug: 'greekpeak'    },
  { file: 'races/racetheghost.html', label: 'Race the Ghost', url: '/races/racetheghost', slug: 'racetheghost' },
  // General pages
  { file: 'timing.html',    label: 'Timing Services', url: '/timing',    slug: null },
  { file: 'volunteer.html', label: 'Volunteering',    url: '/volunteer', slug: null },
  { file: 'about.html',     label: 'About',           url: '/about',     slug: null },
  { file: 'index.html',     label: 'Home',            url: '/',          slug: null },
];

// CSS selectors (as string patterns) to extract — in priority order
// We use regex on raw HTML rather than a DOM parser to avoid deps
const SECTION_PATTERNS = [
  // FAQ accordion items: <dt> question + <dd> answer
  { type: 'faq',     regex: /<dt[^>]*>([\s\S]*?)<\/dt>[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/gi },
  // Section headings + following paragraph
  { type: 'section', regex: /<h[23][^>]*>([\s\S]*?)<\/h[23]>([\s\S]*?)<\/p>/gi },
  // Details/summary (another common accordion pattern)
  { type: 'details', regex: /<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi },
];

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSections(html, page) {
  const entries = [];
  let idCounter = 0;

  for (const pattern of SECTION_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(html)) !== null) {
      const title = stripTags(match[1]);
      const body  = stripTags(match[2]);

      // Skip if title or body is too short to be useful
      if (title.length < 4 || body.length < 10) continue;
      // Skip nav/header noise
      if (/^(home|races|timing|volunteer|about|contact)$/i.test(title)) continue;

      entries.push({
        id:           `${page.slug || page.file.replace(/[^a-z0-9]/gi, '-')}-${idCounter++}`,
        title:        title.slice(0, 120),
        body:         body.slice(0, 600),
        source_label: page.label,
        source_url:   page.url,
        race_slug:    page.slug,
        type:         pattern.type,
        // Searchable blob: title + body lowercased, used at search time
        _search:      (title + ' ' + body).toLowerCase(),
      });
    }
  }

  return entries;
}

function build() {
  const allEntries = [];

  for (const page of PAGES) {
    const filePath = path.join(SITE_ROOT, page.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  SKIP (not found): ${page.file}`);
      continue;
    }

    const html = fs.readFileSync(filePath, 'utf8');
    const entries = extractSections(html, page);
    console.log(`  ${page.file}: ${entries.length} entries`);
    allEntries.push(...entries);
  }

  // Deduplicate by title+body fingerprint (some pages repeat content)
  const seen = new Set();
  const deduped = allEntries.filter(e => {
    const key = e.title.slice(0, 40) + e.body.slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  fs.writeFileSync(OUTPUT, JSON.stringify(deduped, null, 2));
  console.log(`\nWrote ${deduped.length} entries to ${OUTPUT}`);
}

console.log('Building search index...');
build();
