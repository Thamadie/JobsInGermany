(function () {
  'use strict';
  const { api, esc, icon, jobCard, skeletonCards, reveal, observeCounters, CATEGORY_ICONS } = window.JIG;

  // Rotating city name in the hero headline
  const cities = ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart'];
  const rotator = document.getElementById('rotator');
  let idx = 0;
  setInterval(() => {
    const current = rotator.querySelector('.rotator-word');
    current.classList.add('out');
    current.addEventListener('animationend', () => {
      idx = (idx + 1) % cities.length;
      rotator.innerHTML = `<span class="rotator-word">${cities[idx]}</span>`;
    }, { once: true });
  }, 2600);

  // City ticker
  const tickerCities = ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dresden', 'Bremen', 'Hanover', 'Nuremberg'];
  const items = tickerCities.map((c) => `<span class="marquee-item">${c}</span>`).join('');
  document.getElementById('marquee').innerHTML = items + items;

  const featured = document.getElementById('featured-jobs');
  featured.innerHTML = skeletonCards(4);

  api('/api/meta').then((meta) => {
    const set = (id, n) => {
      const el = document.getElementById(id);
      el.dataset.count = n;
      el.textContent = '0';
    };
    set('stat-jobs', meta.stats.jobs);
    set('stat-companies', meta.stats.companies);
    set('stat-visa', meta.stats.visa);
    document.getElementById('fc-live').textContent = meta.stats.jobs;
    observeCounters();

    document.getElementById('cities').innerHTML = meta.locations.map((l) => `<option value="${esc(l)}">`).join('');

    const cats = meta.categories.filter((c) => c !== 'Other').slice(0, 8);
    document.getElementById('cat-grid').innerHTML = cats.map((c, i) => {
      const n = meta.categoryCounts[c] || 0;
      return `
        <a class="cat-card" href="/jobs?category=${encodeURIComponent(c)}" data-reveal style="--d:${i * 0.06}s">
          <span class="cat-arrow">${icon('arrowUpRight')}</span>
          <span class="cat-icon">${icon(CATEGORY_ICONS[c] || 'grid')}</span>
          <span><span class="cat-name">${esc(c)}</span><br><span class="cat-count">${n} open position${n === 1 ? '' : 's'}</span></span>
        </a>`;
    }).join('');
    reveal();
  }).catch(() => {});

  api('/api/jobs?featured=1&limit=6')
    .then(async ({ jobs }) => {
      if (jobs.length < 4) {
        const more = await api('/api/jobs?limit=6');
        const ids = new Set(jobs.map((j) => j.id));
        jobs = jobs.concat(more.jobs.filter((j) => !ids.has(j.id))).slice(0, 6);
      }
      featured.innerHTML = jobs.length
        ? jobs.map(jobCard).join('')
        : '<p class="section-sub">New jobs are coming soon — check back shortly!</p>';
      reveal(featured);
    })
    .catch(() => {
      featured.innerHTML = '<p class="section-sub">Could not load jobs right now. Please refresh the page.</p>';
    });
})();
