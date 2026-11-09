(function () {
  'use strict';
  const { api, esc, icon, toast, companyLogo, initials, timeAgo, salaryRange, hydrateIcons } = window.JIG;

  const $ = (id) => document.getElementById(id);
  const VIEWS = {
    dashboard: ['Dashboard', 'Overview of your job portal'],
    jobs: ['Jobs', 'Create, edit and manage job listings'],
    applications: ['Applications', 'Review candidates and download their CVs'],
  };
  const STATUS_LABELS = {
    new: 'New', reviewing: 'Reviewing', shortlisted: 'Shortlisted', interview: 'Interview',
    offered: 'Offered', hired: 'Hired', rejected: 'Rejected', active: 'Active', draft: 'Draft', closed: 'Closed',
  };

  let options = null;
  let jobs = [];
  let applications = [];
  const jobFilter = { q: '', status: '' };
  const appFilter = { q: '', jobId: '', status: '' };

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // ---------------------------------------------------------------- auth

  async function boot() {
    try {
      const me = await api('/api/admin/me');
      $('avatar').textContent = (me.username || 'A')[0].toUpperCase();
      $('pw-warning').hidden = !me.defaultPassword;
      showApp();
    } catch (e) {
      showLogin();
    }
  }

  function showLogin() {
    $('app').hidden = true;
    $('login').hidden = false;
    setTimeout(() => $('l-user').focus(), 50);
  }

  async function showApp() {
    $('login').hidden = true;
    $('app').hidden = false;
    options = options || (await api('/api/admin/options'));
    fillSelects();
    route();
  }

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('login-error');
    err.classList.remove('show');
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await api('/api/admin/login', { method: 'POST', body: { username: $('l-user').value, password: $('l-pass').value } });
      $('l-pass').value = '';
      await boot();
      toast('Welcome back!');
    } catch (ex) {
      err.textContent = ex.message;
      void err.offsetWidth;
      err.classList.add('show');
    } finally {
      btn.disabled = false;
    }
  });

  $('logout').addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
    showLogin();
  });

  // Any 401 from the API means the session expired.
  async function call(url, opts) {
    try {
      return await api(url, opts);
    } catch (e) {
      if (e.status === 401) {
        showLogin();
        toast('Your session has expired. Please sign in again.', 'error');
      }
      throw e;
    }
  }

  // ---------------------------------------------------------------- routing

  function route() {
    const [view, query] = (location.hash.slice(1) || 'dashboard').split('?');
    const name = VIEWS[view] ? view : 'dashboard';
    if (name === 'applications' && query) {
      const p = new URLSearchParams(query);
      appFilter.jobId = p.get('jobId') || '';
      appFilter.status = p.get('status') || '';
    }
    document.querySelectorAll('.view').forEach((v) => (v.hidden = v.dataset.view !== name));
    document.querySelectorAll('.side-nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === name));
    $('view-title').textContent = VIEWS[name][0];
    $('view-sub').textContent = VIEWS[name][1];
    closeSidebar();
    if (name === 'dashboard') loadDashboard();
    if (name === 'jobs') loadJobs();
    if (name === 'applications') loadApplications();
  }
  window.addEventListener('hashchange', () => !$('app').hidden && route());

  function refreshCounts() {
    $('nav-jobs').textContent = jobs.filter((j) => j.status === 'active').length || '';
    const fresh = applications.filter((a) => a.status === 'new').length;
    $('nav-apps').textContent = fresh || '';
  }

  // ---------------------------------------------------------------- dashboard

  async function loadDashboard() {
    const s = await call('/api/admin/stats');
    const stat = (cls, ic, value, label) =>
      `<div class="stat ${cls}"><div class="stat-icon">${icon(ic)}</div><strong data-count="${value}">0</strong><span>${label}</span></div>`;
    $('stat-grid').innerHTML = [
      stat('', 'briefcase', s.jobs.active, 'Active jobs'),
      stat('red', 'inbox', s.applications.total, 'Total applications'),
      stat('gold', 'star', s.applications.byStatus.new || 0, 'New applications'),
      stat('light', 'users', (s.applications.byStatus.interview || 0) + (s.applications.byStatus.shortlisted || 0), 'Shortlisted & interviews'),
    ].join('');
    window.JIG.observeCounters($('stat-grid'));

    // Applications per day: one series, one hue, hover tooltip per bar.
    const max = Math.max(1, ...s.days.map((d) => d.count));
    const dayLabel = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    $('day-chart').innerHTML = s.days.map((d, i) => `
      <div class="bar-col" tabindex="0" aria-label="${dayLabel(d.date)}: ${d.count} applications">
        <span class="bar-tip">${dayLabel(d.date)} · <strong>${d.count}</strong></span>
        <div class="bar${d.count ? '' : ' zero'}" style="height:${(d.count / max) * 100}%;animation-delay:${i * 0.04}s"></div>
      </div>`).join('') +
      `<div style="position:absolute;inset:0 auto auto 0;font-size:12px;color:var(--muted)">max ${max}</div>`;
    let labels = $('day-chart').nextElementSibling;
    if (!labels || !labels.classList.contains('bar-labels')) {
      labels = document.createElement('div');
      labels.className = 'bar-labels';
      $('day-chart').after(labels);
    }
    labels.innerHTML = s.days.map((d) => `<span>${dayLabel(d.date)}</span>`).join('');

    const total = Math.max(1, s.applications.total);
    $('status-bars').innerHTML = options.applicationStatuses.map((st, i) => {
      const n = s.applications.byStatus[st] || 0;
      return `<div class="sbar-row"><span>${STATUS_LABELS[st]}</span><div class="sbar-track"><div class="sbar-fill" style="width:${(n / total) * 100}%;animation-delay:${i * 0.06}s"></div></div><strong>${n}</strong></div>`;
    }).join('');

    $('top-jobs').innerHTML = s.topJobs.length
      ? s.topJobs.map((j) => `
        <div class="list-row">
          ${companyLogo(j.company)}
          <div class="grow"><strong>${esc(j.title)}</strong><small>${esc(j.company)}</small></div>
          <a class="count-pill" href="#applications?jobId=${encodeURIComponent(j.id)}">${j.count}</a>
        </div>`).join('')
      : '<div class="empty-small">No jobs yet.</div>';

    $('recent-apps').innerHTML = s.recent.length
      ? s.recent.map((a) => `
        <div class="list-row" style="cursor:pointer" data-open-app="${esc(a.id)}">
          <div class="company-logo v2">${esc(initials(`${a.firstName} ${a.lastName}`))}</div>
          <div class="grow"><strong>${esc(a.firstName)} ${esc(a.lastName)}</strong><small>${esc(a.jobTitle)} · ${esc(timeAgo(a.createdAt))}</small></div>
          <span class="pill-select st-${esc(a.status)}" style="background-image:none;padding-right:12px">${STATUS_LABELS[a.status] || esc(a.status)}</span>
        </div>`).join('')
      : '<div class="empty-small">No applications yet. They will appear here as soon as candidates apply.</div>';

    // Keep sidebar counters fresh
    jobs = (await call('/api/admin/jobs')).jobs;
    applications = (await call('/api/admin/applications')).applications;
    refreshCounts();
  }

  document.addEventListener('click', (e) => {
    const row = e.target.closest('[data-open-app]');
    if (row) openApplication(row.dataset.openApp);
  });

  // ---------------------------------------------------------------- jobs

  async function loadJobs() {
    $('jobs-body').innerHTML = '<tr><td colspan="7" class="empty-small">Loading…</td></tr>';
    jobs = (await call('/api/admin/jobs')).jobs;
    refreshCounts();
    renderJobs();
  }

  function statusSelect(kind, id, value, list) {
    return `<select class="pill-select st-${esc(value)}" data-${kind}-status="${esc(id)}" aria-label="Status">${list
      .map((s) => `<option value="${s}"${s === value ? ' selected' : ''}>${STATUS_LABELS[s] || s}</option>`).join('')}</select>`;
  }

  function renderJobs() {
    const q = jobFilter.q.toLowerCase();
    const list = jobs.filter((j) =>
      (!jobFilter.status || j.status === jobFilter.status) &&
      (!q || `${j.title} ${j.company} ${j.location} ${j.category}`.toLowerCase().includes(q))
    );
    if (!list.length) {
      $('jobs-body').innerHTML = `<tr><td colspan="7"><div class="empty-small">${jobs.length ? 'No jobs match your filters.' : 'No jobs yet. Click “New job” to create your first listing.'}</div></td></tr>`;
      return;
    }
    $('jobs-body').innerHTML = list.map((j, i) => `
      <tr style="animation-delay:${Math.min(i, 12) * 0.03}s">
        <td><div class="cell-main">${companyLogo(j.company)}<div><strong>${esc(j.title)}</strong><small>${esc(j.company)} · ${esc(salaryRange(j, true))}</small></div></div></td>
        <td><div class="mini-tags"><span class="tag">${esc(j.location)}</span><span class="tag">${esc(j.workMode)}</span></div></td>
        <td>${statusSelect('job', j.id, j.status, options.jobStatuses)}</td>
        <td><a class="apps-link" href="#applications?jobId=${encodeURIComponent(j.id)}">${j.applicationsCount}</a></td>
        <td><button class="star-btn${j.featured ? ' on' : ''}" data-feature="${esc(j.id)}" aria-label="Toggle featured" aria-pressed="${j.featured}">${icon('star')}</button></td>
        <td style="white-space:nowrap">${fmtDate(j.createdAt)}</td>
        <td><div class="actions">
          <a class="icon-btn" href="/job?id=${encodeURIComponent(j.id)}" target="_blank" rel="noopener" title="View on website" aria-label="View on website">${icon('eye')}</a>
          <button class="icon-btn" data-edit="${esc(j.id)}" title="Edit" aria-label="Edit">${icon('edit')}</button>
          <button class="icon-btn" data-duplicate="${esc(j.id)}" title="Duplicate" aria-label="Duplicate">${icon('copy')}</button>
          <button class="icon-btn danger" data-delete-job="${esc(j.id)}" title="Delete" aria-label="Delete">${icon('trash')}</button>
        </div></td>
      </tr>`).join('');
  }

  $('jobs-search').addEventListener('input', (e) => { jobFilter.q = e.target.value; renderJobs(); });
  $('jobs-status-filter').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    jobFilter.status = b.dataset.value;
    $('jobs-status-filter').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    renderJobs();
  });

  $('jobs-body').addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-job-status]');
    if (!sel) return;
    const id = sel.dataset.jobStatus;
    try {
      const { job } = await call(`/api/admin/jobs/${id}`, { method: 'PATCH', body: { status: sel.value } });
      Object.assign(jobs.find((j) => j.id === id), job);
      sel.className = `pill-select st-${job.status}`;
      refreshCounts();
      toast(`Job marked as ${STATUS_LABELS[job.status].toLowerCase()}`);
    } catch (err) { toast(err.message, 'error'); }
  });

  $('jobs-body').addEventListener('click', async (e) => {
    const t = (attr) => e.target.closest(`[data-${attr}]`);
    let el;
    if ((el = t('feature'))) {
      const job = jobs.find((j) => j.id === el.dataset.feature);
      try {
        const res = await call(`/api/admin/jobs/${job.id}`, { method: 'PATCH', body: { featured: !job.featured } });
        job.featured = res.job.featured;
        el.classList.toggle('on', job.featured);
        el.setAttribute('aria-pressed', job.featured);
        el.animate([{ transform: 'scale(1.5) rotate(30deg)' }, { transform: 'none' }], { duration: 400, easing: 'ease-out' });
        toast(job.featured ? 'Job is now featured on the homepage' : 'Job removed from featured');
      } catch (err) { toast(err.message, 'error'); }
    } else if ((el = t('edit'))) {
      openJobEditor(jobs.find((j) => j.id === el.dataset.edit));
    } else if ((el = t('duplicate'))) {
      try {
        await call(`/api/admin/jobs/${el.dataset.duplicate}/duplicate`, { method: 'POST' });
        toast('Job duplicated as draft');
        loadJobs();
      } catch (err) { toast(err.message, 'error'); }
    } else if ((el = t('delete-job'))) {
      const job = jobs.find((j) => j.id === el.dataset.deleteJob);
      const ok = await confirmDialog(`“${job.title}” will be removed from the website. Existing applications are kept.`);
      if (!ok) return;
      try {
        await call(`/api/admin/jobs/${job.id}`, { method: 'DELETE' });
        toast('Job deleted');
        loadJobs();
      } catch (err) { toast(err.message, 'error'); }
    }
  });

  // ---------------------------------------------------------------- job editor

  function fillSelects() {
    const fill = (id, list, labels) => {
      $(id).innerHTML = list.map((v) => `<option value="${esc(v)}">${esc(labels ? labels[v] : v)}</option>`).join('');
    };
    fill('j-category', options.categories);
    fill('j-type', options.jobTypes);
    fill('j-mode', options.workModes);
    fill('j-exp', options.experience);
    fill('j-german', options.germanLevels);
    fill('j-status', options.jobStatuses, STATUS_LABELS);
    $('apps-status').innerHTML = '<option value="">All statuses</option>' +
      options.applicationStatuses.map((s) => `<option value="${s}">${STATUS_LABELS[s]}</option>`).join('');
  }

  let editingId = null;
  function openJobEditor(job) {
    editingId = job ? job.id : null;
    const form = $('job-form');
    form.reset();
    $('job-error').classList.remove('show');
    $('job-modal-title').textContent = job ? 'Edit job' : 'New job';
    $('job-save').textContent = job ? 'Save changes' : 'Publish job';
    const defaults = { status: 'active', type: 'Full-time', workMode: 'On-site', experience: 'Mid-level', germanLevel: 'Not required', category: 'IT & Software' };
    const data = job || defaults;
    Array.from(form.elements).forEach((el) => {
      if (!el.name || !(el.name in data)) return;
      if (el.type === 'checkbox') el.checked = Boolean(data[el.name]);
      else el.value = data[el.name] == null ? '' : data[el.name];
    });
    if (!job) $('j-desc').value = 'Responsibilities:\n- \n\nRequirements:\n- \n\nWe offer:\n- ';
    openModal('job-modal');
    setTimeout(() => $('j-title').focus(), 100);
  }

  $('new-job-btn').addEventListener('click', () => openJobEditor(null));

  $('job-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const body = {};
    Array.from(form.elements).forEach((el) => {
      if (!el.name) return;
      body[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    const missing = ['title', 'company', 'location', 'description'].filter((k) => !String(body[k]).trim());
    form.querySelectorAll('.field').forEach((f) => f.classList.remove('invalid'));
    if (missing.length) {
      missing.forEach((k) => form.elements[k].closest('.field').classList.add('invalid'));
      form.elements[missing[0]].focus();
      return showFormError('job-error', 'Please fill in all required fields.');
    }
    const btn = $('job-save');
    btn.disabled = true;
    try {
      if (editingId) await call(`/api/admin/jobs/${editingId}`, { method: 'PUT', body });
      else await call('/api/admin/jobs', { method: 'POST', body });
      closeModal('job-modal');
      toast(editingId ? 'Job updated' : 'Job published');
      if (location.hash.startsWith('#jobs')) loadJobs();
      else location.hash = '#jobs';
    } catch (err) {
      showFormError('job-error', err.message);
    } finally {
      btn.disabled = false;
    }
  });

  function showFormError(id, msg) {
    const el = $(id);
    el.textContent = msg;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  // ---------------------------------------------------------------- applications

  function appQuery() {
    const p = new URLSearchParams();
    Object.entries(appFilter).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  }

  function updateExportLinks() {
    const p = new URLSearchParams();
    if (appFilter.jobId) p.set('jobId', appFilter.jobId);
    if (appFilter.status) p.set('status', appFilter.status);
    const qs = p.toString() ? `?${p}` : '';
    $('export-csv').href = `/api/admin/applications/export.csv${qs}`;
    $('export-zip').href = `/api/admin/applications/export.zip${qs}`;
  }

  async function loadApplications() {
    $('apps-body').innerHTML = '<tr><td colspan="6" class="empty-small">Loading…</td></tr>';
    const [jobsRes, appsRes] = await Promise.all([call('/api/admin/jobs'), call('/api/admin/applications')]);
    jobs = jobsRes.jobs;
    applications = appsRes.applications;
    refreshCounts();

    // Job filter includes deleted jobs that still have applications.
    const jobOptions = new Map(jobs.map((j) => [j.id, `${j.title} – ${j.company}`]));
    applications.forEach((a) => { if (!jobOptions.has(a.jobId)) jobOptions.set(a.jobId, `${a.jobTitle} (deleted)`); });
    $('apps-job').innerHTML = '<option value="">All jobs</option>' +
      [...jobOptions].map(([id, label]) => `<option value="${esc(id)}">${esc(label)}</option>`).join('');
    $('apps-job').value = appFilter.jobId;
    $('apps-status').value = appFilter.status;
    $('apps-search').value = appFilter.q;
    renderApplications();
  }

  function renderApplications() {
    updateExportLinks();
    const q = appFilter.q.toLowerCase();
    const list = applications.filter((a) =>
      (!appFilter.jobId || a.jobId === appFilter.jobId) &&
      (!appFilter.status || a.status === appFilter.status) &&
      (!q || `${a.firstName} ${a.lastName} ${a.email} ${a.jobTitle} ${a.company} ${a.currentLocation} ${a.nationality}`.toLowerCase().includes(q))
    );
    if (!list.length) {
      $('apps-body').innerHTML = `<tr><td colspan="6"><div class="empty-small">${applications.length ? 'No applications match your filters.' : 'No applications yet.'}</div></td></tr>`;
      return;
    }
    $('apps-body').innerHTML = list.map((a, i) => `
      <tr style="animation-delay:${Math.min(i, 12) * 0.03}s">
        <td><div class="cell-main" style="cursor:pointer" data-open-app="${esc(a.id)}">
          <div class="company-logo v2">${esc(initials(`${a.firstName} ${a.lastName}`))}</div>
          <div><strong>${esc(a.firstName)} ${esc(a.lastName)}</strong><small>${esc(a.email)}</small></div>
        </div></td>
        <td><strong style="font-weight:600">${esc(a.jobTitle)}</strong><br><small class="muted">${esc(a.company)}</small></td>
        <td><div class="mini-tags">
          <span class="tag">German: ${esc(a.germanLevel)}</span>
          ${a.needsVisa ? '<span class="tag tag-red">Needs visa</span>' : ''}
          ${a.currentLocation ? `<span class="tag">${esc(a.currentLocation)}</span>` : ''}
        </div></td>
        <td style="white-space:nowrap" title="${esc(new Date(a.createdAt).toLocaleString())}">${fmtDate(a.createdAt)}</td>
        <td>${statusSelect('app', a.id, a.status, options.applicationStatuses)}</td>
        <td><div class="actions">
          <button class="icon-btn" data-open-app="${esc(a.id)}" title="View" aria-label="View application">${icon('eye')}</button>
          <a class="icon-btn" href="/api/admin/applications/${encodeURIComponent(a.id)}/cv" title="Download CV" aria-label="Download CV">${icon('download')}</a>
          <button class="icon-btn danger" data-delete-app="${esc(a.id)}" title="Delete" aria-label="Delete application">${icon('trash')}</button>
        </div></td>
      </tr>`).join('');
  }

  let searchTimer;
  $('apps-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { appFilter.q = e.target.value; renderApplications(); }, 200);
  });
  $('apps-job').addEventListener('change', (e) => { appFilter.jobId = e.target.value; syncAppHash(); renderApplications(); });
  $('apps-status').addEventListener('change', (e) => { appFilter.status = e.target.value; syncAppHash(); renderApplications(); });

  function syncAppHash() {
    const p = new URLSearchParams();
    if (appFilter.jobId) p.set('jobId', appFilter.jobId);
    if (appFilter.status) p.set('status', appFilter.status);
    history.replaceState(null, '', `#applications${p.toString() ? `?${p}` : ''}`);
  }

  async function setAppStatus(id, status, sel) {
    try {
      const { application } = await call(`/api/admin/applications/${id}`, { method: 'PATCH', body: { status } });
      const local = applications.find((a) => a.id === id);
      if (local) Object.assign(local, application);
      if (sel) sel.className = `pill-select st-${status}`;
      refreshCounts();
      toast(`Status changed to ${STATUS_LABELS[status]}`);
      return application;
    } catch (err) {
      toast(err.message, 'error');
      return null;
    }
  }

  $('apps-body').addEventListener('change', (e) => {
    const sel = e.target.closest('[data-app-status]');
    if (sel) setAppStatus(sel.dataset.appStatus, sel.value, sel);
  });

  async function deleteApplication(id) {
    const a = applications.find((x) => x.id === id);
    const name = a ? `${a.firstName} ${a.lastName}` : 'this candidate';
    const ok = await confirmDialog(`The application from ${name} and the uploaded CV will be permanently deleted.`);
    if (!ok) return false;
    try {
      await call(`/api/admin/applications/${id}`, { method: 'DELETE' });
      applications = applications.filter((x) => x.id !== id);
      refreshCounts();
      renderApplications();
      toast('Application deleted');
      return true;
    } catch (err) {
      toast(err.message, 'error');
      return false;
    }
  }

  $('apps-body').addEventListener('click', (e) => {
    const del = e.target.closest('[data-delete-app]');
    if (del) deleteApplication(del.dataset.deleteApp);
  });

  async function openApplication(id) {
    let a;
    try {
      a = (await call(`/api/admin/applications/${id}`)).application;
    } catch (err) {
      return toast(err.message, 'error');
    }
    const kv = (label, value) => `<div><small>${label}</small><span>${value || '—'}</span></div>`;
    const ext = (a.cvExt || '').replace('.', '').toUpperCase();
    const cvUrl = `/api/admin/applications/${encodeURIComponent(a.id)}/cv`;
    $('drawer-body').innerHTML = `
      <div class="cand-head">
        <div class="cand-avatar">${esc(initials(`${a.firstName} ${a.lastName}`))}</div>
        <div><h3>${esc(a.firstName)} ${esc(a.lastName)}</h3><p>Applied for <strong>${esc(a.jobTitle)}</strong> · ${esc(timeAgo(a.createdAt))}</p></div>
      </div>
      <label class="field"><span style="font-weight:600;font-size:14px;display:block;margin-bottom:6px">Status</span>${statusSelect('drawer', a.id, a.status, options.applicationStatuses).replace('<select', '<select style="font-size:14px;padding:9px 32px 9px 14px"')}</label>
      <div class="kv">
        ${kv('Email', `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>`)}
        ${kv('Phone', a.phone ? `<a href="tel:${esc(a.phone)}">${esc(a.phone)}</a>` : '')}
        ${kv('Current location', esc(a.currentLocation))}
        ${kv('Nationality', esc(a.nationality))}
        ${kv('German level', esc(a.germanLevel))}
        ${kv('Needs visa', a.needsVisa ? 'Yes' : 'No')}
        ${kv('Available from', a.availableFrom ? esc(fmtDate(a.availableFrom)) : '')}
        ${kv('Expected salary', a.expectedSalary ? esc(window.JIG.euro.format(a.expectedSalary)) : '')}
      </div>
      ${a.linkedin ? `<div class="kv" style="grid-template-columns:1fr;margin-top:0">${kv('Profile link', `<a href="${esc(a.linkedin)}" target="_blank" rel="noopener noreferrer">${esc(a.linkedin)}</a>`)}</div>` : ''}
      <div class="drawer-section">
        <h4>CV / Resume</h4>
        <div class="cv-box">
          <div class="fi">${esc(ext)}</div>
          <div class="grow"><strong>${esc(a.cvOriginalName || 'CV')}</strong><small class="muted">${a.cvSize ? `${Math.round(a.cvSize / 1024)} KB` : ''}</small></div>
          ${ext === 'PDF' ? `<a class="icon-btn" href="${cvUrl}?inline=1" target="_blank" rel="noopener" title="Open" aria-label="Open CV">${icon('eye')}</a>` : ''}
          <a class="icon-btn" href="${cvUrl}" title="Download" aria-label="Download CV">${icon('download')}</a>
        </div>
      </div>
      ${a.coverLetter ? `<div class="drawer-section"><h4>Cover letter</h4><div class="cover">${esc(a.coverLetter)}</div></div>` : ''}
      <div class="drawer-section">
        <h4>Internal notes</h4>
        <textarea class="input" id="app-notes" rows="4" placeholder="Only visible to admins…">${esc(a.notes || '')}</textarea>
        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
          <button class="btn btn-dark btn-sm" id="save-notes" type="button">Save notes</button>
          <a class="btn btn-outline btn-sm" href="mailto:${esc(a.email)}?subject=${encodeURIComponent(`Your application: ${a.jobTitle}`)}">${icon('mail')} Email candidate</a>
          <button class="btn btn-sm" style="margin-left:auto;color:var(--red)" id="drawer-delete" type="button">${icon('trash')} Delete</button>
        </div>
      </div>`;

    $('drawer-body').querySelector('[data-drawer-status]').addEventListener('change', async (e) => {
      const updated = await setAppStatus(a.id, e.target.value, e.target);
      if (updated) renderIfVisible();
    });
    $('save-notes').addEventListener('click', async () => {
      try {
        await call(`/api/admin/applications/${a.id}`, { method: 'PATCH', body: { notes: $('app-notes').value } });
        const local = applications.find((x) => x.id === a.id);
        if (local) local.notes = $('app-notes').value;
        toast('Notes saved');
      } catch (err) { toast(err.message, 'error'); }
    });
    $('drawer-delete').addEventListener('click', async () => {
      if (await deleteApplication(a.id)) {
        closeModal('app-drawer');
        if (!$('app').querySelector('[data-view="dashboard"]').hidden) loadDashboard();
      }
    });
    openModal('app-drawer');

    // Opening a new application moves it to "reviewing" automatically.
    if (a.status === 'new') {
      const updated = await setAppStatus(a.id, 'reviewing', $('drawer-body').querySelector('[data-drawer-status]'));
      if (updated) {
        $('drawer-body').querySelector('[data-drawer-status]').value = 'reviewing';
        renderIfVisible();
      }
    }
  }

  function renderIfVisible() {
    if (!document.querySelector('.view[data-view="applications"]').hidden) renderApplications();
    if (!document.querySelector('.view[data-view="dashboard"]').hidden) loadDashboard();
  }

  // ---------------------------------------------------------------- modals

  let lastFocus = null;
  function openModal(id) {
    lastFocus = document.activeElement;
    const m = $(id);
    m.classList.remove('closing');
    m.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    const m = $(id);
    if (m.hidden) return;
    m.classList.add('closing');
    setTimeout(() => {
      m.hidden = true;
      m.classList.remove('closing');
      if (!document.querySelector('.modal:not([hidden]), .drawer:not([hidden])')) document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }, 260);
  }

  document.querySelectorAll('.modal, .drawer').forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closeModal(m.id);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.modal:not([hidden]), .drawer:not([hidden])')].pop();
    if (open) closeModal(open.id);
  });

  let confirmResolve = null;
  function confirmDialog(text) {
    $('confirm-text').textContent = text;
    openModal('confirm');
    setTimeout(() => $('confirm-ok').focus(), 50);
    return new Promise((resolve) => { confirmResolve = resolve; });
  }
  $('confirm-ok').addEventListener('click', () => {
    closeModal('confirm');
    if (confirmResolve) confirmResolve(true);
    confirmResolve = null;
  });
  $('confirm').addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') && confirmResolve) {
      confirmResolve(false);
      confirmResolve = null;
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmResolve) { confirmResolve(false); confirmResolve = null; }
  });

  // ---------------------------------------------------------------- mobile sidebar

  function closeSidebar() {
    $('sidebar').classList.remove('open');
    $('side-backdrop').classList.remove('show');
  }
  $('menu-btn').addEventListener('click', () => {
    $('sidebar').classList.add('open');
    $('side-backdrop').classList.add('show');
  });
  $('side-backdrop').addEventListener('click', closeSidebar);

  hydrateIcons();
  boot();
})();
