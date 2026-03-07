/**
 * AoaS JWT utilities — uses Node.js crypto (no external deps)
 * Standard HS256 JWT format.
 */
import { createHmac, randomBytes } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const ACCESS_TTL_MS  = 15 * 60 * 1000;       // 15 minutes
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret() {
  if (process.env.AUTH_JWT_SECRET) return process.env.AUTH_JWT_SECRET;
  // Auto-generate + persist locally
  const secretPath = join(homedir(), '.ogu', 'jwt.secret');
  if (existsSync(secretPath)) return readFileSync(secretPath, 'utf-8').trim();
  const secret = randomBytes(48).toString('hex');
  mkdirSync(join(homedir(), '.ogu'), { recursive: true });
  writeFileSync(secretPath, secret, 'utf-8');
  return secret;
}

function getRefreshSecret() {
  if (process.env.AUTH_JWT_REFRESH_SECRET) return process.env.AUTH_JWT_REFRESH_SECRET;
  return getSecret() + '_refresh';
}

function base64url(buf) {
  return (typeof buf === 'string' ? Buffer.from(buf) : buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sign(payload, secret) {
  const header  = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body    = base64url(JSON.stringify(payload));
  const sig     = base64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verify(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = base64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Sign a short-lived access token (15 min).
 */
export function signAccessToken(payload) {
  return sign({ ...payload, exp: Date.now() + ACCESS_TTL_MS, type: 'access' }, getSecret());
}

/**
 * Sign a long-lived refresh token (30 days).
 */
export function signRefreshToken(payload) {
  return sign({ ...payload, exp: Date.now() + REFRESH_TTL_MS, type: 'refresh' }, getRefreshSecret());
}

/**
 * Verify any token (auto-detects access vs refresh by secret).
 * Returns payload or null.
 */
export function verifyToken(token) {
  // Try access first, then refresh
  return verify(token, getSecret()) || verify(token, getRefreshSecret());
}

/**
 * Verify specifically as a refresh token.
 */
export function verifyRefreshToken(token) {
  return verify(token, getRefreshSecret());
}

/**
 * Extract Bearer token from Authorization header.
 */
export function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const t = authHeader.slice(7).trim();
  return t || null;
}

export { ACCESS_TTL_MS, REFRESH_TTL_MS };
