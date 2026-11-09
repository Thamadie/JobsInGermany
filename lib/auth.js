'use strict';

// Minimal admin authentication: one admin account configured through
// environment variables. Sessions are stored (hashed) in MongoDB so they
// survive restarts, and referenced by an HttpOnly, SameSite=Strict cookie.

const crypto = require('crypto');
const store = require('./store');

const COOKIE = 'jig_admin';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const USING_DEFAULT_PASSWORD = !process.env.ADMIN_PASSWORD;

const failedLogins = new Map(); // ip -> { count, until }

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function cookieAttrs(req) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return `Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}

function isLockedOut(ip) {
  const entry = failedLogins.get(ip);
  return entry && entry.until > Date.now();
}

function recordFailure(ip) {
  const entry = failedLogins.get(ip) || { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= 5) {
    entry.until = Date.now() + 15 * 60 * 1000;
    entry.count = 0;
  }
  failedLogins.set(ip, entry);
}

async function login(req, res) {
  const ip = req.ip;
  if (isLockedOut(ip)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
  }
  const { username, password } = req.body || {};
  if (!safeEqual(username || '', ADMIN_USERNAME) || !safeEqual(password || '', ADMIN_PASSWORD)) {
    recordFailure(ip);
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  failedLogins.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  await store.createSession(token, new Date(Date.now() + SESSION_TTL_MS));
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Max-Age=${SESSION_TTL_MS / 1000}; ${cookieAttrs(req)}`);
  res.json({ ok: true, username: ADMIN_USERNAME });
}

async function logout(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) await store.deleteSession(token);
  res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; ${cookieAttrs(req)}`);
  res.json({ ok: true });
}

async function isAuthenticated(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  return store.sessionValid(token);
}

async function requireAdmin(req, res, next) {
  if (!(await isAuthenticated(req))) return res.status(401).json({ error: 'Not authenticated.' });
  next();
}

module.exports = { login, logout, isAuthenticated, requireAdmin, ADMIN_USERNAME, USING_DEFAULT_PASSWORD };
