'use strict';

const path = require('path');
const fs = require('fs');

// Load settings from .env (MONGODB_URI, ADMIN_PASSWORD, ...) when present.
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const express = require('express');
const multer = require('multer');
const archiver = require('archiver');

const store = require('./lib/store');
const auth = require('./lib/auth');

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.disable('x-powered-by');
// Behind a hosting proxy (Render, Railway, Heroku…) set TRUST_PROXY=1 so
// rate limits see the visitor's IP instead of the proxy's.
const trustProxy = process.env.TRUST_PROXY;
app.set('trust proxy', trustProxy ? (/^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy) : 'loopback');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '200kb' }));

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Working student', 'Mini-job'];
const WORK_MODES = ['On-site', 'Hybrid', 'Remote'];
const EXPERIENCE = ['Entry level', 'Junior', 'Mid-level', 'Senior', 'Lead'];
const GERMAN_LEVELS = ['Not required', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Native'];
const JOB_STATUSES = ['active', 'draft', 'closed'];
const APP_STATUSES = ['new', 'reviewing', 'shortlisted', 'interview', 'offered', 'hired', 'rejected'];
const CATEGORIES = [
  'IT & Software', 'Engineering', 'Healthcare', 'Finance', 'Marketing & Sales', 'Design',
  'Skilled Trades', 'Logistics', 'Hospitality', 'Education', 'Science & Research', 'Other',
];

const CV_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const MAX_CV_BYTES = 5 * 1024 * 1024;

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function sanitizeJob(body) {
  const errors = [];
  const job = {
    title: str(body.title, 140),
    company: str(body.company, 120),
    location: str(body.location, 80),
    type: oneOf(body.type, JOB_TYPES, 'Full-time'),
    workMode: oneOf(body.workMode, WORK_MODES, 'On-site'),
    category: oneOf(body.category, CATEGORIES, 'Other'),
    experience: oneOf(body.experience, EXPERIENCE, 'Mid-level'),
    germanLevel: oneOf(body.germanLevel, GERMAN_LEVELS, 'Not required'),
    salaryMin: toInt(body.salaryMin),
    salaryMax: toInt(body.salaryMax),
    visaSponsorship: Boolean(body.visaSponsorship),
    featured: Boolean(body.featured),
    status: oneOf(body.status, JOB_STATUSES, 'active'),
    summary: str(body.summary, 300),
    description: str(body.description, 20000),
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(body.deadline || '') ? body.deadline : '',
  };
  if (!job.title) errors.push('Title is required.');
  if (!job.company) errors.push('Company is required.');
  if (!job.location) errors.push('Location is required.');
  if (!job.description) errors.push('Description is required.');
  if (job.salaryMin != null && job.salaryMax != null && job.salaryMin > job.salaryMax) {
    errors.push('Minimum salary cannot be higher than maximum salary.');
  }
  return { job, errors };
}

function isOpen(job) {
  if (job.status !== 'active') return false;
  if (job.deadline && job.deadline < new Date().toISOString().slice(0, 10)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// File uploads (CVs)
// ---------------------------------------------------------------------------

// CVs are held in memory (max 5 MB) and then written to MongoDB GridFS.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CV_BYTES, files: 1, fields: 20, fieldSize: 10000 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!CV_EXTENSIONS.includes(ext)) return cb(new Error('CV must be a PDF, DOC or DOCX file.'));
    cb(null, true);
  },
});

const CV_CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

// Simple per-IP rate limit for applications.
const applyHits = new Map();
function applyRateLimit(req, res, next) {
  const now = Date.now();
  const hits = (applyHits.get(req.ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (hits.length >= 20) return res.status(429).json({ error: 'Too many applications. Please try again later.' });
  hits.push(now);
  applyHits.set(req.ip, hits);
  next();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

app.get('/api/health', async (req, res) => {
  try {
    await store.ping();
    res.json({ ok: true, database: 'connected' });
  } catch (e) {
    res.status(503).json({ ok: false, database: 'unreachable' });
  }
});

app.get('/api/meta', async (req, res) => {
  const open = (await store.listJobs({ status: 'active' })).filter(isOpen);
  const count = (key) =>
    open.reduce((acc, j) => ((acc[j[key]] = (acc[j[key]] || 0) + 1), acc), {});
  res.json({
    jobTypes: JOB_TYPES,
    workModes: WORK_MODES,
    experience: EXPERIENCE,
    germanLevels: GERMAN_LEVELS,
    categories: CATEGORIES,
    categoryCounts: count('category'),
    locations: Object.keys(count('location')).sort(),
    stats: {
      jobs: open.length,
      companies: new Set(open.map((j) => j.company)).size,
      cities: new Set(open.map((j) => j.location)).size,
      visa: open.filter((j) => j.visaSponsorship).length,
    },
  });
});

app.get('/api/jobs', async (req, res) => {
  const q = str(req.query.q).toLowerCase();
  const location = str(req.query.location).toLowerCase();
  const { category, type, workMode, experience } = req.query;
  const visa = req.query.visa === '1';
  const featured = req.query.featured === '1';
  const sort = req.query.sort;

  let jobs = (await store.listJobs({ status: 'active' })).filter(isOpen);
  if (q) {
    jobs = jobs.filter((j) =>
      [j.title, j.company, j.summary, j.category, j.description].join(' ').toLowerCase().includes(q)
    );
  }
  if (location) jobs = jobs.filter((j) => j.location.toLowerCase().includes(location));
  if (category) jobs = jobs.filter((j) => j.category === category);
  if (type) jobs = jobs.filter((j) => j.type === type);
  if (workMode) jobs = jobs.filter((j) => j.workMode === workMode);
  if (experience) jobs = jobs.filter((j) => j.experience === experience);
  if (visa) jobs = jobs.filter((j) => j.visaSponsorship);
  if (featured) jobs = jobs.filter((j) => j.featured);
  if (sort === 'salary') jobs.sort((a, b) => (b.salaryMax || 0) - (a.salaryMax || 0));

  const limit = toInt(req.query.limit);
  if (limit) jobs = jobs.slice(0, limit);
  res.json({ jobs: jobs });
});

app.get('/api/jobs/:id', async (req, res) => {
  const job = await store.getJob(req.params.id);
  if (!job || job.status === 'draft') return res.status(404).json({ error: 'Job not found.' });
  res.json({ job, open: isOpen(job) });
});

function parseCvUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload.single('cv')(req, res, (err) => {
      if (!err) return resolve();
      if (err.code === 'LIMIT_FILE_SIZE') err.message = 'CV must be smaller than 5 MB.';
      reject(err);
    });
  });
}

app.post('/api/jobs/:id/apply', applyRateLimit, async (req, res) => {
  try {
    await parseCvUpload(req, res);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Upload failed.' });
  }
  const job = await store.getJob(req.params.id);
  if (!job || !isOpen(job)) {
    return res.status(404).json({ error: 'This job is no longer accepting applications.' });
  }

  const b = req.body || {};
  // Honeypot field: real users never fill it in.
  if (b.website) return res.json({ ok: true });

  const data = {
    firstName: str(b.firstName, 80),
    lastName: str(b.lastName, 80),
    email: str(b.email, 160).toLowerCase(),
    phone: str(b.phone, 40),
    currentLocation: str(b.currentLocation, 120),
    nationality: str(b.nationality, 80),
    germanLevel: oneOf(b.germanLevel, GERMAN_LEVELS, 'Not required'),
    needsVisa: b.needsVisa === 'yes',
    availableFrom: /^\d{4}-\d{2}-\d{2}$/.test(b.availableFrom || '') ? b.availableFrom : '',
    expectedSalary: toInt(b.expectedSalary),
    linkedin: str(b.linkedin, 300),
    coverLetter: str(b.coverLetter, 8000),
  };

  const errors = [];
  if (!data.firstName || !data.lastName) errors.push('Please enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Please enter a valid email address.');
  if (!req.file) errors.push('Please upload your CV.');
  if (data.linkedin && !/^https?:\/\//i.test(data.linkedin)) errors.push('Profile link must start with http:// or https://');
  if (b.consent !== 'yes') errors.push('Please accept the privacy notice.');
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const duplicateMsg = 'You have already applied for this job with this email address.';
  if (await store.findApplication(job.id, data.email)) return res.status(409).json({ error: duplicateMsg });

  const cvExt = path.extname(req.file.originalname).toLowerCase();
  const cvOriginalName = path.basename(req.file.originalname).replace(/[^\w.\- ()]/g, '_').slice(0, 120);
  const cvFileId = await store.saveCv(req.file.buffer, cvOriginalName, CV_CONTENT_TYPES[cvExt]);

  try {
    const application = await store.createApplication({
      ...data,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      cvFileId,
      cvExt,
      cvOriginalName,
      cvSize: req.file.size,
    });
    res.status(201).json({ ok: true, id: application.id });
  } catch (err) {
    await store.deleteCv(cvFileId);
    // Unique index on (jobId, email) catches two simultaneous submissions.
    if (err.code === 11000) return res.status(409).json({ error: duplicateMsg });
    throw err;
  }
});

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------

app.post('/api/admin/login', auth.login);
app.post('/api/admin/logout', auth.logout);
app.get('/api/admin/me', async (req, res) => {
  if (!(await auth.isAuthenticated(req))) return res.status(401).json({ error: 'Not authenticated.' });
  res.json({ username: auth.ADMIN_USERNAME, defaultPassword: auth.USING_DEFAULT_PASSWORD });
});

const admin = express.Router();
admin.use(auth.requireAdmin);

admin.get('/options', (req, res) => {
  res.json({
    jobTypes: JOB_TYPES, workModes: WORK_MODES, experience: EXPERIENCE, germanLevels: GERMAN_LEVELS,
    categories: CATEGORIES, jobStatuses: JOB_STATUSES, applicationStatuses: APP_STATUSES,
  });
});

admin.get('/stats', async (req, res) => {
  const [jobs, apps, counts] = await Promise.all([store.listJobs(), store.listApplications(), store.countApplicationsByJob()]);
  const byStatus = Object.fromEntries(APP_STATUSES.map((s) => [s, 0]));
  apps.forEach((a) => (byStatus[a.status] = (byStatus[a.status] || 0) + 1));

  // Applications per day for the last 14 days.
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    days.push({ date: d, count: apps.filter((a) => a.createdAt.slice(0, 10) === d).length });
  }

  const topJobs = jobs
    .map((j) => ({ id: j.id, title: j.title, company: j.company, count: counts[j.id] || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    jobs: {
      total: jobs.length,
      active: jobs.filter((j) => j.status === 'active').length,
      draft: jobs.filter((j) => j.status === 'draft').length,
      closed: jobs.filter((j) => j.status === 'closed').length,
    },
    applications: { total: apps.length, byStatus },
    days,
    topJobs,
    recent: apps.slice(0, 6),
  });
});

admin.get('/jobs', async (req, res) => {
  const [list, counts] = await Promise.all([store.listJobs(), store.countApplicationsByJob()]);
  const jobs = list.map((j) => ({ ...j, applicationsCount: counts[j.id] || 0 }));
  res.json({ jobs });
});

admin.get('/jobs/:id', async (req, res) => {
  const job = await store.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  res.json({ job });
});

admin.post('/jobs', async (req, res) => {
  const { job, errors } = sanitizeJob(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  res.status(201).json({ job: await store.createJob(job) });
});

admin.put('/jobs/:id', async (req, res) => {
  const { job, errors } = sanitizeJob(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const updated = await store.updateJob(req.params.id, job);
  if (!updated) return res.status(404).json({ error: 'Job not found.' });
  res.json({ job: updated });
});

admin.patch('/jobs/:id', async (req, res) => {
  const job = await store.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  const patch = {};
  if ('status' in req.body) patch.status = oneOf(req.body.status, JOB_STATUSES, job.status);
  if ('featured' in req.body) patch.featured = Boolean(req.body.featured);
  res.json({ job: await store.updateJob(job.id, patch) });
});

admin.post('/jobs/:id/duplicate', async (req, res) => {
  const job = await store.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  const { id, createdAt, updatedAt, ...rest } = job;
  res.status(201).json({ job: await store.createJob({ ...rest, title: `${job.title} (copy)`, status: 'draft' }) });
});

admin.delete('/jobs/:id', async (req, res) => {
  if (!(await store.deleteJob(req.params.id))) return res.status(404).json({ error: 'Job not found.' });
  res.json({ ok: true });
});

async function filterApplications(query) {
  const filter = {};
  if (typeof query.jobId === 'string' && query.jobId) filter.jobId = query.jobId;
  if (typeof query.status === 'string' && query.status) filter.status = query.status;
  let apps = await store.listApplications(filter);
  const q = str(query.q).toLowerCase();
  if (q) {
    apps = apps.filter((a) =>
      [a.firstName, a.lastName, a.email, a.jobTitle, a.company, a.currentLocation, a.nationality]
        .join(' ').toLowerCase().includes(q)
    );
  }
  return apps;
}

admin.get('/applications', async (req, res) => {
  res.json({ applications: await filterApplications(req.query) });
});

function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // prevent spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
}

function applicationsCsv(apps) {
  const cols = [
    ['Applied at', (a) => a.createdAt],
    ['Status', (a) => a.status],
    ['Job', (a) => a.jobTitle],
    ['Company', (a) => a.company],
    ['First name', (a) => a.firstName],
    ['Last name', (a) => a.lastName],
    ['Email', (a) => a.email],
    ['Phone', (a) => a.phone],
    ['Current location', (a) => a.currentLocation],
    ['Nationality', (a) => a.nationality],
    ['German level', (a) => a.germanLevel],
    ['Needs visa', (a) => (a.needsVisa ? 'Yes' : 'No')],
    ['Available from', (a) => a.availableFrom],
    ['Expected salary (EUR)', (a) => a.expectedSalary],
    ['Profile link', (a) => a.linkedin],
    ['Cover letter', (a) => a.coverLetter],
    ['Notes', (a) => a.notes],
    ['CV file', (a) => a.cvOriginalName],
  ];
  const lines = [cols.map((c) => csvCell(c[0])).join(',')];
  apps.forEach((a) => lines.push(cols.map((c) => csvCell(c[1](a))).join(',')));
  return '﻿' + lines.join('\r\n');
}

async function exportName(query, ext) {
  const job = typeof query.jobId === 'string' && query.jobId && (await store.getJob(query.jobId));
  const slug = job ? job.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) : 'all';
  return `applications-${slug}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

admin.get('/applications/export.csv', async (req, res) => {
  const apps = await filterApplications(req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${await exportName(req.query, 'csv')}"`);
  res.send(applicationsCsv(apps));
});

function cvDownloadName(a) {
  const ext = a.cvExt || path.extname(a.cvOriginalName || '');
  const base = `${a.firstName}-${a.lastName}-CV`.replace(/[^\w\-]+/g, '_');
  return `${base}${ext}`;
}

admin.get('/applications/export.zip', async (req, res) => {
  const apps = await filterApplications(req.query);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${await exportName(req.query, 'zip')}"`);
  const zip = archiver('zip', { zlib: { level: 6 } });
  zip.on('error', () => res.destroy());
  zip.pipe(res);
  zip.append(applicationsCsv(apps), { name: 'applications.csv' });
  const used = new Set();
  for (const a of apps) {
    if (!a.cvFileId || !(await store.cvExists(a.cvFileId))) continue;
    let name = cvDownloadName(a);
    if (used.has(name)) name = `${a.id}-${name}`;
    used.add(name);
    // archiver reads the streams one at a time, so only one CV is open at once.
    zip.append(store.openCv(a.cvFileId), { name: `cvs/${name}` });
  }
  zip.finalize();
});

admin.get('/applications/:id', async (req, res) => {
  const a = await store.getApplication(req.params.id);
  if (!a) return res.status(404).json({ error: 'Application not found.' });
  res.json({ application: a });
});

admin.get('/applications/:id/cv', async (req, res) => {
  const a = await store.getApplication(req.params.id);
  if (!a || !a.cvFileId) return res.status(404).json({ error: 'CV not found.' });
  if (!(await store.cvExists(a.cvFileId))) return res.status(404).json({ error: 'CV file is missing.' });
  const inline = req.query.inline === '1' && a.cvExt === '.pdf';
  res.setHeader('Content-Type', CV_CONTENT_TYPES[a.cvExt] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${cvDownloadName(a)}"`);
  if (a.cvSize) res.setHeader('Content-Length', a.cvSize);
  store.openCv(a.cvFileId).on('error', () => res.destroy()).pipe(res);
});

admin.patch('/applications/:id', async (req, res) => {
  const a = await store.getApplication(req.params.id);
  if (!a) return res.status(404).json({ error: 'Application not found.' });
  const patch = {};
  if ('status' in req.body) patch.status = oneOf(req.body.status, APP_STATUSES, a.status);
  if ('notes' in req.body) patch.notes = str(req.body.notes, 5000);
  res.json({ application: await store.updateApplication(a.id, patch) });
});

admin.delete('/applications/:id', async (req, res) => {
  const removed = await store.deleteApplication(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Application not found.' });
  await store.deleteCv(removed.cvFileId);
  res.json({ ok: true });
});

app.use('/api/admin', admin);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ---------------------------------------------------------------------------
// Static site
// ---------------------------------------------------------------------------

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

function connectionHint(err) {
  const msg = `${err.message} ${err.cause ? err.cause.message : ''}`;
  if (err.code === 'PLACEHOLDER_URI') {
    return 'Replace the whole MONGODB_URI line in .env with the full connection string copied from Atlas → your cluster → Connect → Drivers, ' +
      'then put in your database user\'s name and password (without the < > brackets).';
  }
  if (/getaddrinfo (ENOTFOUND|EAI_AGAIN)/.test(msg)) {
    return 'The cluster was found, but its database servers\' addresses could not be looked up. Your network\'s DNS is blocking them. ' +
      'Set DNS_SERVERS=8.8.8.8,1.1.1.1 in .env, switch your computer\'s DNS to 8.8.8.8 / 1.1.1.1, or turn off your VPN. See README → Troubleshooting.';
  }
  if (['ENOTFOUND', 'ENODATA'].includes(err.code) || /ENOTFOUND|ENODATA/.test(msg)) {
    return 'The cluster address was not found. Copy the connection string again from Atlas → Connect → Drivers and check the part after the @.';
  }
  if (err.syscall === 'querySrv' || /querySrv|queryTxt/.test(msg)) {
    return 'Your network\'s DNS server refused the lookup that mongodb+srv:// addresses need. Set DNS_SERVERS=8.8.8.8,1.1.1.1 in .env, ' +
      'switch your computer\'s DNS to 8.8.8.8 / 1.1.1.1, or use the standard (non-SRV) connection string from Atlas. See README → Troubleshooting.';
  }
  if (/auth|Authentication failed|bad auth/i.test(msg)) {
    return 'Atlas rejected the username or password. Check the database user in Atlas → Database Access, and URL-encode special characters in the password.';
  }
  if (err.name === 'MongoServerSelectionError' || /Server selection timed out|ETIMEDOUT|ECONNRESET/.test(msg)) {
    return 'The cluster could not be reached. Make sure Atlas → Network Access allows this computer\'s IP address, and that your network allows outgoing connections on port 27017.';
  }
  return 'Check MONGODB_URI, your database user/password, and that Atlas Network Access allows this server\'s IP address.';
}

store
  .connect()
  .then(() => {
    console.log('Connected to MongoDB.');
    const server = app.listen(PORT, () => {
      console.log(`Jobs in Germany running on http://localhost:${PORT}`);
      console.log(`Admin panel: http://localhost:${PORT}/admin`);
      if (auth.USING_DEFAULT_PASSWORD) {
        console.warn('WARNING: using the default admin password. Set ADMIN_PASSWORD before going live.');
      }
    });
    const shutdown = () => server.close(() => store.close().finally(() => process.exit(0)));
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  })
  .catch((err) => {
    console.error(`Could not connect to MongoDB: ${err.message}`);
    console.error(connectionHint(err));
    process.exit(1);
  });
