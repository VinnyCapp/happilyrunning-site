/**
 * search.js — Contact page FAQ search widget
 * Loaded only on contact.html
 * No dependencies. No API calls. Pure client-side keyword search.
 */

(function() {
  'use strict';

  const WIDGET_ID   = 'hr-search-widget';
  const INDEX_URL   = '/data/search-index.json';
  const MAX_RESULTS = 3;
  const DEBOUNCE_MS = 220;

  let index = null;  // loaded once on first keystroke

  // ── Scoring ──────────────────────────────────────────────────────────────
  // Returns a numeric score for how well an entry matches the query.
  // Higher = better match.
  function score(entry, terms) {
    const blob = entry._search;
    let s = 0;

    // Exact phrase match (highest signal)
    const phrase = terms.join(' ');
    if (blob.includes(phrase)) s += 100;

    // Title contains phrase
    if (entry.title.toLowerCase().includes(phrase)) s += 50;

    // All terms present
    const allPresent = terms.every(t => blob.includes(t));
    if (allPresent) s += 40;

    // Title contains all terms
    const titleLower = entry.title.toLowerCase();
    if (terms.every(t => titleLower.includes(t))) s += 20;

    // Individual term hits
    for (const t of terms) {
      if (blob.includes(t)) s += 5;
      if (titleLower.includes(t)) s += 3;
    }

    return s;
  }

  function search(query) {
    if (!index) return [];
    const raw = query.trim().toLowerCase();
    if (raw.length < 2) return [];

    // Tokenize: split on whitespace, drop stop words, require min 2 chars
    const STOPWORDS = new Set(['a','an','the','is','are','was','were','do','does',
      'did','to','of','in','on','at','for','and','or','but','how','what',
      'when','where','who','will','can','i','my','me','we','our']);
    const terms = raw.split(/\s+/).filter(t => t.length >= 2 && !STOPWORDS.has(t));
    if (terms.length === 0) return [];

    const scored = index
      .map(entry => ({ entry, s: score(entry, terms) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_RESULTS)
      .map(x => x.entry);

    return scored;
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  function renderResult(entry) {
    const card = document.createElement('div');
    card.className = 'hr-search-result';

    const label = document.createElement('div');
    label.className = 'hr-search-result__source';
    label.textContent = entry.source_label;

    const title = document.createElement('div');
    title.className = 'hr-search-result__title';
    title.textContent = entry.title;

    const body = document.createElement('div');
    body.className = 'hr-search-result__body';
    // Truncate body for display
    const displayBody = entry.body.length > 280
      ? entry.body.slice(0, 280).replace(/\s+\S*$/, '') + '…'
      : entry.body;
    body.textContent = displayBody;

    const link = document.createElement('a');
    link.className = 'hr-search-result__link';
    link.href = entry.source_url;
    link.textContent = 'Read more →';
    link.setAttribute('target', '_self');

    card.appendChild(label);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(link);
    return card;
  }

  function renderNoResults() {
    const msg = document.createElement('div');
    msg.className = 'hr-search-noresults';
    msg.textContent = 'Nothing matched — use the form below or email us directly.';
    return msg;
  }

  function updateResults(resultsEl, query) {
    resultsEl.innerHTML = '';

    if (!query || query.trim().length < 2) return;

    if (!index) {
      // Show loading state — index not fetched yet
      const loading = document.createElement('div');
      loading.className = 'hr-search-loading';
      loading.textContent = 'Loading…';
      resultsEl.appendChild(loading);
      return;
    }

    const results = search(query);
    if (results.length === 0) {
      resultsEl.appendChild(renderNoResults());
    } else {
      results.forEach(r => resultsEl.appendChild(renderResult(r)));
    }
  }

  // ── Index loading ──────────────────────────────────────────────────────────
  function loadIndex(callback) {
    if (index !== null) { callback(); return; }
    fetch(INDEX_URL)
      .then(r => r.json())
      .then(data => { index = data; callback(); })
      .catch(() => {
        // If index fails to load, widget degrades silently — form still works
        index = [];
        callback();
      });
  }

  // ── Widget init ────────────────────────────────────────────────────────────
  function init() {
    const mountPoint = document.getElementById(WIDGET_ID);
    if (!mountPoint) return;  // not on contact page, bail

    // Build DOM
    const wrapper = document.createElement('div');
    wrapper.className = 'hr-search-wrapper';

    const label = document.createElement('label');
    label.className = 'hr-search-label';
    label.setAttribute('for', 'hr-search-input');
    label.textContent = 'Got a quick question? Search first.';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'hr-search-input';
    input.className = 'hr-search-input';
    input.placeholder = 'e.g. "Tesla Hertz course length" or "Shore2Shore bus time"';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');

    const resultsEl = document.createElement('div');
    resultsEl.className = 'hr-search-results';
    resultsEl.setAttribute('aria-live', 'polite');

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    wrapper.appendChild(resultsEl);
    mountPoint.appendChild(wrapper);

    // Debounced input handler
    let timer = null;
    input.addEventListener('input', function() {
      const q = this.value;
      clearTimeout(timer);

      if (!q || q.trim().length < 2) {
        resultsEl.innerHTML = '';
        return;
      }

      // Show placeholder while debouncing
      timer = setTimeout(function() {
        if (!index) {
          // Kick off index load, then re-run
          updateResults(resultsEl, q);  // show loading state
          loadIndex(function() { updateResults(resultsEl, q); });
        } else {
          updateResults(resultsEl, q);
        }
      }, DEBOUNCE_MS);
    });
  }

  // Run on DOMContentLoaded (or immediately if already loaded)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
