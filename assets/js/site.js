// Happily Running — site.js v0.6.0
(() => {
  // ———— Icon injection ————
  // Use: <a><span class="ico" data-icon="pin"></span><span class="label">Directions</span></a>
  const ICONS = {
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    bed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>',
    parking: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 1 1 0 6H9"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 2 7v13l7-3 6 3 7-3V4l-7 3z"/><path d="M9 4v13"/><path d="M15 7v13"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 1 0-4 0v5"/><path d="M14 10V4a2 2 0 1 0-4 0v6"/><path d="M10 10.5V6a2 2 0 1 0-4 0v11"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.5-2.5l-3.5-5c-.7-1.2-.2-2.4 1-3s2 .2 2.5 1L8 16"/></svg>',
    track: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>',
    mountain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>',
  };

  document.querySelectorAll('.ico[data-icon]').forEach(el => {
    const name = el.getAttribute('data-icon');
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });

  // ———— Mobile nav ————
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', links.classList.contains('is-open'));
    });
  }

  // ———— Reveal on scroll ————
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-in'));
  }

  // ———— Gallery ————
  // A <div data-gallery="shore2shore"> loads /data/galleries/shore2shore.json
  const galleryContainers = document.querySelectorAll('[data-gallery]');
  if (galleryContainers.length) {
    const allPhotos = [];
    let lightboxIndex = 0;

    // Build lightbox once
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = '<button class="lightbox-close" aria-label="Close">×</button><button class="lightbox-nav lightbox-prev" aria-label="Previous">‹</button><img alt=""><button class="lightbox-nav lightbox-next" aria-label="Next">›</button>';
    document.body.appendChild(lightbox);
    const lightboxImg = lightbox.querySelector('img');

    function openLightbox(idx) {
      if (!allPhotos[idx]) return;
      lightboxIndex = idx;
      lightboxImg.src = allPhotos[idx].full || allPhotos[idx].thumb;
      lightbox.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
    function closeLightbox() {
      lightbox.classList.remove('is-open');
      document.body.style.overflow = '';
    }
    function nav(dir) {
      if (!allPhotos.length) return;
      lightboxIndex = (lightboxIndex + dir + allPhotos.length) % allPhotos.length;
      lightboxImg.src = allPhotos[lightboxIndex].full || allPhotos[lightboxIndex].thumb;
    }

    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.querySelector('.lightbox-prev').addEventListener('click', e => { e.stopPropagation(); nav(-1); });
    lightbox.querySelector('.lightbox-next').addEventListener('click', e => { e.stopPropagation(); nav(1); });
    lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', e => {
      if (!lightbox.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') nav(-1);
      if (e.key === 'ArrowRight') nav(1);
    });

    // Load each gallery sequentially
    function loadGallery(container) {
      const slug = container.getAttribute('data-gallery');
      const max = parseInt(container.getAttribute('data-max') || '12', 10);
      const grid = container.querySelector('.gallery-grid');
      const albumLink = container.querySelector('.gallery-album-link');

      if (!grid) {
        console.warn('[gallery] no .gallery-grid inside', container);
        return;
      }

      fetch('/data/galleries/' + slug + '.json', { cache: 'no-cache' })
        .then(function(res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function(data) {
          let photos = (data.photos || []).slice();
          if (!photos.length) {
            container.style.display = 'none';
            return;
          }

          // Fisher-Yates shuffle — fresh random order every page load
          for (let i = photos.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [photos[i], photos[j]] = [photos[j], photos[i]];
          }

          photos = photos.slice(0, max);

          photos.forEach(function(photo) {
            const startIdx = allPhotos.length;
            allPhotos.push(photo);

            const item = document.createElement('div');
            item.className = 'gallery-item';

            const img = document.createElement('img');
            img.loading = 'lazy';
            img.alt = '';
            img.addEventListener('load', function() {
              item.classList.add('is-loaded');
            });
            img.src = photo.thumb;

            item.appendChild(img);
            item.addEventListener('click', function() { openLightbox(startIdx); });
            grid.appendChild(item);
          });

          if (albumLink && data.album_url) {
            albumLink.href = data.album_url;
            albumLink.style.display = '';
          }
        })
        .catch(function(err) {
          console.warn('[gallery] load failed for ' + slug + ':', err.message);
          container.style.display = 'none';
        });
    }

    galleryContainers.forEach(loadGallery);
  }

  // ———— Pricing loader (data/races.json → race page sidebars) ————
  // Looks for [data-pricing-card="<slug>"] (registration card with price-increase date)
  // and [data-pricing-list="<slug>"] (the pricing breakdown list)
  // Populates both from /data/races.json
  const pricingTargets = document.querySelectorAll('[data-pricing-card], [data-pricing-list]');
  if (pricingTargets.length) {
    function formatPrice(n) {
      if (n === 0) return 'Free';
      // Show 2 decimals only if needed (39.44 yes, 85 no)
      return '$' + (Number.isInteger(n) ? n : n.toFixed(2));
    }
    function formatIncreaseDate(isoDate) {
      // "2026-08-14" → "August 14, 2026"
      if (!isoDate) return null;
      const d = new Date(isoDate + 'T12:00:00');
      if (isNaN(d.getTime())) return null;
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    fetch('/data/races.json', { cache: 'no-cache' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        const races = data.races || {};

        // Update price-increase dates in registration cards
        document.querySelectorAll('[data-pricing-card]').forEach(function(card) {
          const slug = card.getAttribute('data-pricing-card');
          const race = races[slug];
          if (!race || !race.pricing) return;

          const dateEl = card.querySelector('[data-pricing-increase]');
          if (dateEl && race.pricing.next_increase) {
            const formatted = formatIncreaseDate(race.pricing.next_increase);
            if (formatted) dateEl.textContent = 'Prices increase ' + formatted;
          }
        });

        // Rebuild pricing lists
        document.querySelectorAll('[data-pricing-list]').forEach(function(list) {
          const slug = list.getAttribute('data-pricing-list');
          const race = races[slug];
          if (!race || !race.pricing || !race.pricing.tiers) return;

          const url = race.registration_url || '#';
          const tiers = race.pricing.tiers;

          // Clear and rebuild
          list.innerHTML = '';
          tiers.forEach(function(tier) {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener';

            const labelSpan = document.createElement('span');
            labelSpan.textContent = tier.label;

            const priceSpan = document.createElement('span');
            priceSpan.textContent = formatPrice(tier.price);

            a.appendChild(labelSpan);
            a.appendChild(priceSpan);
            li.appendChild(a);
            list.appendChild(li);
          });
        });
      })
      .catch(function(err) {
        console.warn('[pricing] races.json load failed:', err.message);
        // Leave the static fallback content as-is
      });
  }

  // ———— Up Next badge (data/races.json → soonest active race) ————
  async function markUpNext() {
    const targets = document.querySelectorAll('[data-race]');
    if (!targets.length) return;

    let data;
    try {
      const res = await fetch('/data/races.json', { cache: 'no-store' });
      data = await res.json();
    } catch (e) {
      console.warn('up-next: could not load races.json', e);
      return;
    }

    const races = data && data.races ? data.races : {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upNext = Object.values(races)
      .filter(r => r.slug && r.date_iso && r.status !== 'tba')
      .map(r => ({ ...r, _date: new Date(r.date_iso + 'T00:00:00') }))
      .filter(r => !isNaN(r._date.getTime()) && r._date >= today)
      .sort((a, b) => a._date - b._date)[0];

    if (!upNext) return;

    const daysOut = Math.ceil((upNext._date - today) / 86400000);
    let label = 'UP NEXT';
    let modifier = '';

    if (daysOut <= 1) {
      label = 'RACE DAY';
      modifier = 'is-race-day';
    } else if (daysOut <= 7) {
      label = 'THIS WEEK';
      modifier = 'is-race-week';
    } else if (daysOut <= 30) {
      label = `${daysOut} DAYS`;
      modifier = 'is-soon';
    }

    document.querySelectorAll(`[data-race="${upNext.slug}"]`).forEach(card => {
      const badge = document.createElement('div');
      badge.className = `up-next-badge ${modifier}`.trim();
      badge.textContent = label;
      card.prepend(badge);
      card.classList.add('is-up-next');
    });
  }

  markUpNext();

})();
