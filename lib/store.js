'use strict';

// MongoDB data layer. Jobs and applications live in their own collections;
// CV files are stored in GridFS (bucket "cvs") so the app needs no local disk.
// Documents carry their own string `id`; Mongo's `_id` never leaves this file.

const crypto = require('crypto');
const dns = require('dns');
const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');
const seedJobs = require('./seed');

const NO_ID = { projection: { _id: 0 } };

let client;
let db;
let jobs;
let applications;
let sessions;
let cvBucket;

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. Add your MongoDB Atlas connection string to .env (see .env.example).');
  const placeholder = uri.match(/<[^>]*>|\.xxxxx\./i);
  if (placeholder) {
    const err = new Error(`MONGODB_URI still contains the placeholder "${placeholder[0].replace(/^\.|\.$/g, '')}" from .env.example.`);
    err.code = 'PLACEHOLDER_URI';
    throw err;
  }

  const customDns = Boolean(process.env.DNS_SERVERS);
  if (customDns) dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean));

  try {
    client = await openClient(uri, customDns);
  } catch (err) {
    // Some routers, ISPs and VPNs can't resolve Atlas addresses: the SRV
    // lookup for mongodb+srv:// (querySrv ECONNREFUSED) or the database
    // servers' own names (getaddrinfo ENOTFOUND). Retry with public DNS.
    if (!isDnsError(err) || customDns) throw err;
    console.warn(`DNS lookup for the Atlas cluster failed (${err.code || dnsErrorCode(err)}). Retrying with public DNS servers…`);
    dns.setServers(PUBLIC_DNS);
    client = await openClient(uri, true);
  }
  db = client.db(process.env.MONGODB_DB || 'jobsingermany');
  await db.command({ ping: 1 });

  jobs = db.collection('jobs');
  applications = db.collection('applications');
  sessions = db.collection('sessions');
  cvBucket = new GridFSBucket(db, { bucketName: 'cvs' });

  await Promise.all([
    jobs.createIndex({ id: 1 }, { unique: true }),
    jobs.createIndex({ status: 1, createdAt: -1 }),
    applications.createIndex({ id: 1 }, { unique: true }),
    applications.createIndex({ jobId: 1, email: 1 }, { unique: true }),
    applications.createIndex({ createdAt: -1 }),
    sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);

  if ((await jobs.estimatedDocumentCount()) === 0) await seed();
  return db;
}

const PUBLIC_DNS = ['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1'];

const DNS_ERROR = /\b(querySrv|queryTxt|getaddrinfo) (E[A-Z_]+)/;

function isDnsError(err) {
  return ['querySrv', 'queryTxt', 'getaddrinfo'].includes(err.syscall) || DNS_ERROR.test(err.message || '');
}

function dnsErrorCode(err) {
  const m = DNS_ERROR.exec(err.message || '');
  return m ? m[2] : 'DNS error';
}

// Resolves host names with the DNS servers set via dns.setServers() instead
// of the operating system's resolver (which the MongoDB driver would use).
// Falls back to the system for names only it knows (localhost, hosts file).
function resolverLookup(hostname, options, callback) {
  if (typeof options === 'function') [callback, options] = [options, {}];
  if (typeof options === 'number') options = { family: options };
  const family = options.family;
  Promise.allSettled([
    family === 6 ? null : dns.promises.resolve4(hostname),
    family === 4 ? null : dns.promises.resolve6(hostname),
  ]).then(([v4, v6]) => {
    const addresses = [
      ...((v4.value || []).map((address) => ({ address, family: 4 }))),
      ...((v6.value || []).map((address) => ({ address, family: 6 }))),
    ];
    if (!addresses.length) return dns.lookup(hostname, options, callback);
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}

async function openClient(uri, useResolver) {
  const options = { serverSelectionTimeoutMS: 10000, appName: 'jobs-in-germany' };
  if (useResolver) options.lookup = resolverLookup;
  const c = new MongoClient(uri, options);
  try {
    await c.connect();
  } catch (err) {
    await c.close().catch(() => {});
    throw err;
  }
  return c;
}

async function seed() {
  const now = Date.now();
  await jobs.insertMany(seedJobs.map((job, i) => ({
    id: newId(),
    ...job,
    status: 'active',
    createdAt: new Date(now - i * 36e5 * 19).toISOString(),
    updatedAt: new Date(now - i * 36e5 * 19).toISOString(),
  })));
}

function close() {
  return client ? client.close() : Promise.resolve();
}

function ping() {
  return db.command({ ping: 1 });
}

function newId() {
  return crypto.randomBytes(8).toString('hex');
}

// ---------- Jobs ----------

function listJobs(filter = {}) {
  return jobs.find(filter, NO_ID).sort({ createdAt: -1 }).toArray();
}

function getJob(id) {
  return jobs.findOne({ id: String(id) }, NO_ID);
}

async function createJob(data) {
  const now = new Date().toISOString();
  const job = { id: newId(), ...data, createdAt: now, updatedAt: now };
  await jobs.insertOne({ ...job });
  return job;
}

async function updateJob(id, data) {
  const { id: _ignore, createdAt, _id, ...rest } = data;
  return jobs.findOneAndUpdate(
    { id: String(id) },
    { $set: { ...rest, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after', ...NO_ID }
  );
}

async function deleteJob(id) {
  // Applications are kept (they hold the job title as a snapshot) so nothing is lost.
  const res = await jobs.deleteOne({ id: String(id) });
  return res.deletedCount === 1;
}

// ---------- Applications ----------

function listApplications(filter = {}) {
  return applications.find(filter, NO_ID).sort({ createdAt: -1 }).toArray();
}

function getApplication(id) {
  return applications.findOne({ id: String(id) }, NO_ID);
}

function findApplication(jobId, email) {
  return applications.findOne({ jobId, email }, NO_ID);
}

async function createApplication(data) {
  const app = { id: newId(), status: 'new', notes: '', ...data, createdAt: new Date().toISOString() };
  await applications.insertOne({ ...app });
  return app;
}

function updateApplication(id, data) {
  return applications.findOneAndUpdate(
    { id: String(id) },
    { $set: { ...data, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after', ...NO_ID }
  );
}

function deleteApplication(id) {
  return applications.findOneAndDelete({ id: String(id) }, NO_ID);
}

async function countApplicationsByJob() {
  const rows = await applications.aggregate([{ $group: { _id: '$jobId', count: { $sum: 1 } } }]).toArray();
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
}

// ---------- CV files (GridFS) ----------

function saveCv(buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const upload = cvBucket.openUploadStream(filename, { metadata: { contentType } });
    upload.on('error', reject);
    upload.on('finish', () => resolve(upload.id.toString()));
    upload.end(buffer);
  });
}

function toObjectId(fileId) {
  return ObjectId.isValid(fileId) ? new ObjectId(String(fileId)) : null;
}

async function cvExists(fileId) {
  const _id = toObjectId(fileId);
  return Boolean(_id && (await cvBucket.find({ _id }).limit(1).hasNext()));
}

function openCv(fileId) {
  return cvBucket.openDownloadStream(toObjectId(fileId));
}

async function deleteCv(fileId) {
  const _id = toObjectId(fileId);
  if (!_id) return;
  await cvBucket.delete(_id).catch(() => {});
}

// ---------- Admin sessions ----------

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function createSession(token, expiresAt) {
  return sessions.insertOne({ tokenHash: hashToken(token), expiresAt });
}

async function sessionValid(token) {
  const s = await sessions.findOne({ tokenHash: hashToken(token) });
  return Boolean(s && s.expiresAt > new Date());
}

function deleteSession(token) {
  return sessions.deleteOne({ tokenHash: hashToken(token) });
}

module.exports = {
  connect,
  close,
  ping,
  newId,
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  listApplications,
  getApplication,
  findApplication,
  createApplication,
  updateApplication,
  deleteApplication,
  countApplicationsByJob,
  saveCv,
  cvExists,
  openCv,
  deleteCv,
  createSession,
  sessionValid,
  deleteSession,
};
