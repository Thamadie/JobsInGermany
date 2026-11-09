(function () {
  'use strict';
  const { api, esc, icon, salaryRange, timeAgo, companyLogo, skeletonCards, reveal } = window.JIG;

  const params = new URLSearchParams(location.search);
  const state = {
    q: params.get('q') || '',
    location: params.get('location') || '',
    category: params.get('category') || '',
    type: params.get('type') || '',
    workMode: params.get('workMode') || '',
    experience: params.get('experience') || '',
    visa: params.get('visa') === '1',
    sort: params.get('sort') || '',
  };

  const $ = (id) => document.getElementById(id);
  const results = $('results');
  const filters = $('filters');

  function rowCard(job, i) {
    const tags = [
      `<span class="tag">${icon('pin')}${esc(job.location)}</span>`,
      `<span class="tag">${icon('briefcase')}${esc(job.type)}</span>`,
      `<span class="tag">${icon('home')}${esc(job.workMode)}</span>`,
      `<span class="tag">${icon('language')}German: ${esc(job.germanLevel)}</span>`,
    ];
    if (job.visaSponsorship) tags.push(`<span class="tag tag-red">${icon('passport')}Visa sponsorship</span>`);
    return `
      <article class="job-card" data-reveal style="--d:${Math.min(i, 8) * 0.05}s">
        <div class="job-main">
          <div class="job-top">
            ${companyLogo(job.company)}
            <div>
              <h3 class="job-title"><a class="card-link" href="/job?id=${encodeURIComponent(job.id)}">${esc(job.title)}</a></h3>
              <div class="job-company">${esc(job.company)} · ${esc(job.category)} · ${esc(job.experience)}</div>
            </div>
          </div>
          ${job.summary ? `<p class="job-summary">${esc(job.summary)}</p>` : ''}
          <div class="tags">${tags.join('')}</div>
        </div>
        <div class="job-side">
          ${job.featured ? '<span class="featured-badge">Featured</span>' : ''}
          <div class="salary">${esc(salaryRange(job, true))} <small>/ year</small></div>
          <span class="posted">${icon('clock')} ${esc(timeAgo(job.createdAt))}</span>
          <a class="btn btn-dark btn-sm" href="/job?id=${encodeURIComponent(job.id)}#apply" aria-label="View and apply: ${esc(job.title)}">View &amp; apply ${icon('arrow')}</a>
        </div>
      </article>`;
  }

  function syncUrl() {
    const p = new URLSearchParams();
    Object.entries(state).forEach(([k, v]) => {
      if (v === true) p.set(k, '1');
      else if (v) p.set(k, v);
    });
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
    return qs;
  }

  let requestId = 0;
  async function load() {
    const qs = syncUrl();
    const id = ++requestId;
    results.innerHTML = skeletonCards(3);
    $('results-count').textContent = 'Searching…';
    try {
      const { jobs } = await api(`/api/jobs${qs ? `?${qs}` : ''}`);
      if (id !== requestId) return;
      $('results-count').innerHTML = `<span><strong>${jobs.length}</strong> job${jobs.length === 1 ? '' : 's'} found</span>`;
      if (!jobs.length) {
        results.innerHTML = `
          <div class="empty">
            <div class="empty-icon">${icon('search')}</div>
            <h3>No jobs match your search</h3>
            <p style="color:var(--muted)">Try different keywords or remove some filters.</p>
            <button class="btn btn-primary" type="button" id="empty-clear">Clear filters</button>
          </div>`;
        $('empty-clear').addEventListener('click', clearAll);
        return;
      }
      results.innerHTML = jobs.map(rowCard).join('');
      reveal(results);
    } catch (err) {
      if (id !== requestId) return;
      $('results-count').textContent = '';
      results.innerHTML = `<div class="empty"><h3>Something went wrong</h3><p style="color:var(--muted)">${esc(err.message)}</p></div>`;
    }
  }

  function renderChips(meta) {
    const lists = { category: meta.categories, type: meta.jobTypes, workMode: meta.workModes, experience: meta.experience };
    document.querySelectorAll('[data-filter]').forEach((wrap) => {
      const key = wrap.dataset.filter;
      wrap.innerHTML = lists[key].map((v) => {
        const count = key === 'category' && meta.categoryCounts[v] ? ` <span style="opacity:.55">${meta.categoryCounts[v]}</span>` : '';
        return `<button type="button" class="chip${state[key] === v ? ' active' : ''}" data-value="${esc(v)}">${esc(v)}${count}</button>`;
      }).join('');
      wrap.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        const value = chip.dataset.value;
        state[key] = state[key] === value ? '' : value;
        wrap.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.value === state[key]));
        load();
      });
    });

    const sel = $('f-location');
    const locations = new Set(meta.locations);
    if (state.location) locations.add(state.location);
    sel.innerHTML = '<option value="">All cities</option>' + [...locations].sort().map((l) => `<option${l === state.location ? ' selected' : ''}>${esc(l)}</option>`).join('');
  }

  function clearAll() {
    Object.assign(state, { q: '', location: '', category: '', type: '', workMode: '', experience: '', visa: false });
    $('f-q').value = '';
    $('f-location').value = '';
    $('f-visa').checked = false;
    document.querySelectorAll('.chip.active').forEach((c) => c.classList.remove('active'));
    load();
  }

  $('f-q').value = state.q;
  $('f-visa').checked = state.visa;
  $('f-sort').value = state.sort;

  $('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.q = $('f-q').value.trim();
    load();
  });
  let debounce;
  $('f-q').addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.q = $('f-q').value.trim(); load(); }, 350);
  });
  $('f-location').addEventListener('change', (e) => { state.location = e.target.value; load(); });
  $('f-visa').addEventListener('change', (e) => { state.visa = e.target.checked; load(); });
  $('f-sort').addEventListener('change', (e) => { state.sort = e.target.value; load(); });
  $('clear-filters').addEventListener('click', clearAll);
  $('open-filters').addEventListener('click', () => filters.classList.add('open'));
  $('close-filters').addEventListener('click', () => filters.classList.remove('open'));
  $('apply-filters').addEventListener('click', () => filters.classList.remove('open'));

  api('/api/meta').then(renderChips).catch(() => {});
  load();
})();
