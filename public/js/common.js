/* Shared helpers for the public site and the admin panel. */
(function () {
  'use strict';

  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    euro: '<path d="M17 6.5A7 7 0 1 0 17 17.5M4 10h9M4 14h9"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    language: '<path d="M4 5h8M8 3v2M10 5c-1 4-3.5 7-6 8.5M6 9c1.2 2 3 3.5 5 4.5M13 21l4-9 4 9M14.5 18h5"/>',
    passport: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 16h6"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowUpRight: '<path d="M7 17L17 7M8 7h9v9"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    filter: '<path d="M4 5h16l-6 8v5l-4 2v-7z"/>',
    code: '<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14"/>',
    pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8a2.8 2.8 0 0 1-4-4l8-8-1.3-1.3a4 4 0 0 0-5-5l2.5 2.5-1.4 2.8-2.8 1.4L6.5 6.7"/>',
    truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5zM4 20.5A1.5 1.5 0 0 0 5.5 22H20"/>',
    flask: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3M7 15h10"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    rocket: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M14 4c3-1.5 6-1 6-1s.5 3-1 6l-7 7-5-5zM9 10H5l-2 3 4 1M14 15v4l-3 2-1-4"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    phone: '<path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 7 7L16 14l5 2v3a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    inbox: '<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 13h5l1 3h6l1-3h5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.5M8.2 13.2l7.6 4.5"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    zip: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M11 5h1M11 8h1M11 11h1M10.5 14h2v3h-2z"/>',
  };

  const CATEGORY_ICONS = {
    'IT & Software': 'code', Engineering: 'gear', Healthcare: 'heart', Finance: 'chart',
    'Marketing & Sales': 'megaphone', Design: 'pen', 'Skilled Trades': 'wrench', Logistics: 'truck',
    Hospitality: 'coffee', Education: 'book', 'Science & Research': 'flask', Other: 'grid',
  };

  function icon(name, cls) {
    return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  function hydrateIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      el.outerHTML = icon(el.dataset.icon, el.className);
    });
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  function salaryRange(job, compact) {
    const fmt = (n) => (compact ? `€${Math.round(n / 1000)}k` : euro.format(n));
    if (job.salaryMin && job.salaryMax) return `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}`;
    if (job.salaryMin) return `from ${fmt(job.salaryMin)}`;
    if (job.salaryMax) return `up to ${fmt(job.salaryMax)}`;
    return 'Salary on request';
  }

  function timeAgo(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [name, secs] of units) {
      const n = Math.floor(s / secs);
      if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`;
    }
    return 'just now';
  }

  function initials(name) {
    return String(name || '?').split(/\s+/).filter((w) => /^[A-Za-zÄÖÜäöü]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
  }

  function logoVariant(name) {
    let h = 0;
    for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return ['', 'v1', 'v2'][h % 3];
  }

  function companyLogo(name) {
    return `<div class="company-logo ${logoVariant(name)}" aria-hidden="true">${esc(initials(name))}</div>`;
  }

  async function api(url, options = {}) {
    const opts = { credentials: 'same-origin', ...options };
    if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== 'string') {
      opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
      opts.body = JSON.stringify(opts.body);
    }
    let res;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      showServerNotice();
      throw new Error('Cannot reach the server. Please check your connection and try again.');
    }
    // An HTML reply to an API call means the page is served without the Node
    // server behind it (e.g. only the public/ folder on a static host).
    if (!/json/.test(res.headers.get('content-type') || '')) {
      showServerNotice();
      throw new Error('The job server is not running.');
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function showServerNotice() {
    if (document.querySelector('.server-notice')) return;
    const el = document.createElement('div');
    el.className = 'server-notice';
    el.setAttribute('role', 'alert');
    el.innerHTML = '<strong>The job server isn’t running.</strong> Jobs and applications need it. ' +
      'Start it with <code>npm start</code> in the project folder and open the site at ' +
      '<a href="http://localhost:3000">http://localhost:3000</a>. A static host can’t run it; see the README for hosting.';
    document.body.prepend(el);
  }

  function toast(message, type) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      wrap.setAttribute('role', 'status');
      wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = `toast ${type || ''}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 3200);
  }

  // Scroll-triggered reveal animations
  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          revealObserver.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    : null;

  function reveal(root) {
    (root || document).querySelectorAll('[data-reveal]:not(.in)').forEach((el) => {
      if (revealObserver) revealObserver.observe(el);
      else el.classList.add('in');
    });
  }

  // Count-up numbers
  function countUp(el, target) {
    const duration = 1600;
    const start = performance.now();
    const suffix = el.dataset.suffix || '';
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(target * eased).toLocaleString('de-DE') + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function observeCounters(root) {
    const els = (root || document).querySelectorAll('[data-count]');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => (el.textContent = el.dataset.count + (el.dataset.suffix || '')));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          countUp(e.target, Number(e.target.dataset.count) || 0);
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.5 });
    els.forEach((el) => obs.observe(el));
  }

  // Button ripple effect
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn || btn.disabled) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const r = document.createElement('span');
    r.className = 'ripple';
    r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(r);
    r.addEventListener('animationend', () => r.remove());
  });

  function initHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle('scrolled', y > 30);
      header.classList.toggle('hide', y > 400 && y > lastY && !document.body.classList.contains('nav-open'));
      lastY = y;
      const top = document.querySelector('.to-top');
      if (top) top.classList.toggle('show', y > 700);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const toggle = header.querySelector('.nav-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const open = document.body.classList.toggle('nav-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      header.querySelectorAll('.nav-links a').forEach((a) =>
        a.addEventListener('click', () => document.body.classList.remove('nav-open'))
      );
    }

    const path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    header.querySelectorAll('.nav-links a[data-path]').forEach((a) => {
      if (a.dataset.path === path) a.classList.add('active');
    });

    const top = document.querySelector('.to-top');
    if (top) top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    const year = document.querySelector('[data-year]');
    if (year) year.textContent = new Date().getFullYear();
  }

  function hideLoader() {
    const loader = document.querySelector('.loader');
    if (loader) setTimeout(() => loader.classList.add('done'), 250);
  }

  function jobCard(job, i) {
    const tags = [
      `<span class="tag">${icon('pin')}${esc(job.location)}</span>`,
      `<span class="tag">${icon('briefcase')}${esc(job.type)}</span>`,
      `<span class="tag">${icon('home')}${esc(job.workMode)}</span>`,
    ];
    if (job.visaSponsorship) tags.push(`<span class="tag tag-red">${icon('passport')}Visa sponsorship</span>`);
    if (job.germanLevel === 'Not required') tags.push(`<span class="tag tag-gold">${icon('language')}No German needed</span>`);
    return `
      <article class="job-card${job.featured ? ' has-badge' : ''}" data-reveal style="--d:${(i % 6) * 0.07}s">
        ${job.featured ? '<span class="featured-badge">Featured</span>' : ''}
        <div class="job-top">
          ${companyLogo(job.company)}
          <div>
            <h3 class="job-title"><a class="card-link" href="/job?id=${encodeURIComponent(job.id)}">${esc(job.title)}</a></h3>
            <div class="job-company">${esc(job.company)} · ${esc(job.category)}</div>
          </div>
        </div>
        ${job.summary ? `<p class="job-summary">${esc(job.summary)}</p>` : ''}
        <div class="tags">${tags.join('')}</div>
        <div class="job-bottom">
          <div class="salary">${esc(salaryRange(job, true))} <small>/ year</small></div>
          <span class="posted">${esc(timeAgo(job.createdAt))}</span>
        </div>
      </article>`;
  }

  function skeletonCards(n) {
    return Array.from({ length: n }, () => `
      <div class="job-card skeleton" aria-hidden="true">
        <div class="job-top"><div class="sk" style="width:54px;height:54px;border-radius:15px"></div>
          <div style="flex:1"><div class="sk" style="height:18px;width:70%;margin-bottom:10px"></div><div class="sk" style="height:12px;width:40%"></div></div></div>
        <div class="sk" style="height:12px;width:95%"></div>
        <div style="display:flex;gap:8px"><div class="sk" style="height:26px;width:80px;border-radius:99px"></div><div class="sk" style="height:26px;width:90px;border-radius:99px"></div><div class="sk" style="height:26px;width:70px;border-radius:99px"></div></div>
      </div>`).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    hydrateIcons();
    initHeader();
    reveal();
    observeCounters();
  });
  window.addEventListener('load', hideLoader);
  setTimeout(hideLoader, 2500);

  window.JIG = {
    icon, hydrateIcons, esc, salaryRange, timeAgo, initials, companyLogo, api, toast,
    reveal, observeCounters, jobCard, skeletonCards, CATEGORY_ICONS, euro,
  };
})();
