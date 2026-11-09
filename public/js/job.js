(function () {
  'use strict';
  const { api, esc, icon, salaryRange, timeAgo, companyLogo, toast, reveal, hydrateIcons } = window.JIG;

  const $ = (id) => document.getElementById(id);
  const jobId = new URLSearchParams(location.search).get('id');

  // Turn the plain-text description into headings, paragraphs and lists.
  function renderDescription(text) {
    const blocks = String(text || '').replace(/\r/g, '').split(/\n{2,}/);
    return blocks.map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      let html = '';
      let list = [];
      const flush = () => {
        if (list.length) html += `<ul>${list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`;
        list = [];
      };
      lines.forEach((line) => {
        const bullet = line.match(/^[-*•]\s+(.*)$/);
        if (bullet) return list.push(bullet[1]);
        flush();
        if (/:$/.test(line) && line.length < 60) html += `<h3>${esc(line.slice(0, -1))}</h3>`;
        else html += `<p>${esc(line)}</p>`;
      });
      flush();
      return html;
    }).join('');
  }

  function fact(iconName, label, value) {
    return `<div class="fact"><div class="fact-icon">${icon(iconName)}</div><div><small>${esc(label)}</small><span>${esc(value)}</span></div></div>`;
  }

  function renderJob(job, open) {
    document.title = `${job.title} at ${job.company} – Jobs in Germany`;

    const tags = [
      `<span class="tag tag-dark">${icon('pin')}${esc(job.location)}</span>`,
      `<span class="tag">${icon('briefcase')}${esc(job.type)}</span>`,
      `<span class="tag">${icon('home')}${esc(job.workMode)}</span>`,
    ];
    if (job.visaSponsorship) tags.push(`<span class="tag tag-red">${icon('passport')}Visa sponsorship</span>`);
    if (job.featured) tags.push(`<span class="tag tag-gold">${icon('star')}Featured</span>`);

    $('job-banner').innerHTML = `
      <nav class="breadcrumb" data-reveal><a href="/">Home</a> / <a href="/jobs">Jobs</a> / <span>${esc(job.category)}</span></nav>
      <div class="job-hero-meta" data-reveal style="--d:.1s">
        ${companyLogo(job.company)}
        <div style="flex:1;min-width:260px">
          <h1 style="margin-bottom:8px">${esc(job.title)}</h1>
          <p>${esc(job.company)} · Posted ${esc(timeAgo(job.createdAt))}</p>
        </div>
      </div>
      <div class="tags" style="margin-top:24px;--d:.2s" data-reveal>${tags.join('')}</div>`;

    $('job-body').innerHTML = (job.summary ? `<p style="font-size:18px;color:var(--ink);font-weight:500">${esc(job.summary)}</p>` : '') + renderDescription(job.description);
    $('side-salary').textContent = salaryRange(job);

    const facts = [
      fact('briefcase', 'Job type', job.type),
      fact('home', 'Work mode', job.workMode),
      fact('star', 'Experience', job.experience),
      fact('language', 'German level', job.germanLevel),
      fact('passport', 'Visa sponsorship', job.visaSponsorship ? 'Yes' : 'No'),
      fact('grid', 'Category', job.category),
    ];
    if (job.deadline) {
      facts.push(fact('calendar', 'Apply before', new Date(job.deadline + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })));
    }
    $('facts').innerHTML = facts.join('');

    const url = location.href;
    $('share-mail').href = `mailto:?subject=${encodeURIComponent(job.title)}&body=${encodeURIComponent(url)}`;
    $('share-li').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    $('copy-link').addEventListener('click', () => {
      navigator.clipboard.writeText(url).then(() => toast('Link copied to clipboard'), () => toast('Could not copy link', 'error'));
    });

    if (!open) {
      $('apply-form-wrap').innerHTML = '<div class="closed-note">This position is no longer accepting applications.</div>';
      $('side-apply').remove();
    }

    $('detail').hidden = false;
    reveal();
  }

  async function loadSimilar(job) {
    try {
      const { jobs } = await api(`/api/jobs?category=${encodeURIComponent(job.category)}&limit=4`);
      const similar = jobs.filter((j) => j.id !== job.id).slice(0, 3);
      if (!similar.length) return;
      $('similar').innerHTML = `
        <div class="card" data-reveal="right" style="padding:20px 24px">
          <div style="font-weight:600;margin-bottom:6px">Similar jobs</div>
          ${similar.map((j) => `
            <a href="/job?id=${encodeURIComponent(j.id)}" class="fact" style="text-decoration:none">
              ${companyLogo(j.company).replace('class="company-logo', 'style="width:40px;height:40px;font-size:14px;border-radius:12px" class="company-logo')}
              <div style="min-width:0"><span style="display:block;line-height:1.3">${esc(j.title)}</span><small style="text-transform:none;letter-spacing:0">${esc(j.location)} · ${esc(salaryRange(j, true))}</small></div>
            </a>`).join('')}
        </div>`;
      reveal($('similar'));
    } catch (e) { /* optional */ }
  }

  // ---------------- Application form ----------------

  function setupForm(meta) {
    const form = $('apply-form');
    if (!form) return;
    $('a-german').innerHTML = meta.germanLevels.map((l) => `<option>${esc(l)}</option>`).join('');

    const cvInput = $('a-cv');
    const dropzone = $('dropzone');
    let file = null;

    function showFile(f) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (!['pdf', 'doc', 'docx'].includes(ext)) {
        toast('Please upload a PDF, DOC or DOCX file.', 'error');
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast('Your CV must be smaller than 5 MB.', 'error');
        return;
      }
      file = f;
      $('file-ext').textContent = ext.toUpperCase();
      $('file-name').textContent = f.name;
      $('file-size').textContent = `${(f.size / 1024).toFixed(0)} KB`;
      $('file-chip').classList.add('show');
      dropzone.style.display = 'none';
      $('cv-field').classList.remove('invalid');
    }

    cvInput.addEventListener('change', () => cvInput.files[0] && showFile(cvInput.files[0]));
    ['dragenter', 'dragover'].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => dropzone.addEventListener(ev, () => dropzone.classList.remove('drag')));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files[0]) showFile(e.dataTransfer.files[0]);
    });
    $('file-remove').addEventListener('click', () => {
      file = null;
      cvInput.value = '';
      $('file-chip').classList.remove('show');
      dropzone.style.display = '';
    });

    form.querySelectorAll('.input').forEach((input) =>
      input.addEventListener('input', () => input.closest('.field').classList.remove('invalid'))
    );

    function validate() {
      const invalid = [];
      ['a-first', 'a-last'].forEach((id) => { if (!$(id).value.trim()) invalid.push($(id)); });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('a-email').value.trim())) invalid.push($('a-email'));
      const link = $('a-link').value.trim();
      if (link && !/^https?:\/\//i.test(link)) invalid.push($('a-link'));
      invalid.forEach((el) => {
        const field = el.closest('.field');
        field.classList.remove('invalid');
        void field.offsetWidth; // restart shake animation
        field.classList.add('invalid');
      });
      if (!file) {
        $('cv-field').classList.add('invalid');
        dropzone.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 300 });
      }
      const messages = [];
      if (invalid.length) messages.push('Please check the highlighted fields.');
      if (!file) messages.push('Please upload your CV.');
      if (!$('a-consent').checked) messages.push('Please accept the privacy notice.');
      if (invalid[0]) invalid[0].focus();
      return messages;
    }

    function showError(msg) {
      const el = $('form-error');
      el.textContent = msg;
      el.classList.remove('show');
      void el.offsetWidth;
      el.classList.add('show');
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      $('form-error').classList.remove('show');
      const problems = validate();
      if (problems.length) return showError(problems.join(' '));

      const data = new FormData(form);
      data.set('cv', file, file.name);
      const btn = $('submit-btn');
      const progress = $('progress');
      btn.disabled = true;
      btn.firstChild.textContent = 'Sending… ';
      progress.classList.add('show');

      // XHR instead of fetch so we can show upload progress.
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/jobs/${encodeURIComponent(jobId)}/apply`);
      xhr.upload.addEventListener('progress', (ev) => {
        if (ev.lengthComputable) progress.firstElementChild.style.width = `${(ev.loaded / ev.total) * 100}%`;
      });
      xhr.onload = () => {
        let res = {};
        try { res = JSON.parse(xhr.responseText); } catch (err) { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) {
          $('success-name').textContent = $('a-first').value.trim();
          $('apply-form-wrap').style.display = 'none';
          $('success').classList.add('show');
          $('apply').scrollIntoView({ behavior: 'smooth', block: 'center' });
          const sideApply = $('side-apply');
          if (sideApply) sideApply.outerHTML = `<span class="btn btn-gold btn-block" style="pointer-events:none">${icon('check')} Applied</span>`;
          confetti();
        } else {
          reset();
          showError(res.error || 'Something went wrong. Please try again.');
        }
      };
      xhr.onerror = () => { reset(); showError('Network error. Please check your connection and try again.'); };
      xhr.send(data);

      function reset() {
        btn.disabled = false;
        btn.firstChild.textContent = 'Submit application ';
        progress.classList.remove('show');
        progress.firstElementChild.style.width = '0';
      }
    });
  }

  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#0d0d0d', '#dd0000', '#ffce00'];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = `${Math.random() * 100}vw`;
      c.style.background = colors[i % 3];
      c.style.animationDuration = `${2 + Math.random() * 2.5}s`;
      c.style.animationDelay = `${Math.random() * 0.6}s`;
      c.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      document.body.appendChild(c);
      c.addEventListener('animationend', () => c.remove());
    }
  }

  function notFound() {
    $('job-banner').innerHTML = '<nav class="breadcrumb"><a href="/">Home</a> / <a href="/jobs">Jobs</a></nav><h1>Job not found</h1>';
    $('not-found').hidden = false;
  }

  if (!jobId) return notFound();

  Promise.all([api(`/api/jobs/${encodeURIComponent(jobId)}`), api('/api/meta')])
    .then(([{ job, open }, meta]) => {
      renderJob(job, open);
      if (open) setupForm(meta);
      hydrateIcons();
      loadSimilar(job);
      // Arrived via "View & apply" (job?id=…#apply): the form only exists now, so jump to it.
      if (location.hash === '#apply') {
        setTimeout(() => $('apply').scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
      }
    })
    .catch(notFound);
})();
