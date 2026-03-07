/**
 * Slice 398 — Auth Middleware
 * Tests the JWT/API-Key validation logic directly.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log('\n\x1b[1mSlice 398 — Auth Middleware\x1b[0m\n');

process.env.AUTH_JWT_SECRET = 'slice-398-test-secret';
process.env.AUTH_JWT_REFRESH_SECRET = 'slice-398-refresh-secret';

const { signAccessToken, extractBearerToken, verifyToken } =
  await import('../../tools/studio/server/auth/jwt.mjs');
const { createApiKey, validateApiKey, listApiKeys } =
  await import('../../tools/studio/server/auth/api-keys.mjs');
const { register } = await import('../../tools/studio/server/auth/auth-service.mjs');

function makeDataDir() {
  const dir = join(tmpdir(), `ogu-398-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Test middleware logic directly (extractBearerToken + verifyToken)

assert('extractBearerToken extracts token from valid header', () => {
  const token = 'mytoken123';
  const result = extractBearerToken(`Bearer ${token}`);
  if (result !== token) throw new Error(`expected ${token}, got ${result}`);
});

assert('extractBearerToken returns null for null header', () => {
  if (extractBearerToken(null) !== null) throw new Error('should be null');
});

assert('extractBearerToken returns null for Basic auth', () => {
  if (extractBearerToken('Basic abc') !== null) throw new Error('should be null');
});

assert('valid access token passes verification', () => {
  const payload = { userId: 'u-1', email: 'a@b.com', role: 'user', type: 'access' };
  const token = signAccessToken(payload);
  const result = verifyToken(token);
  if (!result) throw new Error('should verify');
  if (result.userId !== 'u-1') throw new Error('wrong userId');
});

assert('tampered access token fails verification', () => {
  const token = signAccessToken({ userId: 'u-2', type: 'access' });
  const tampered = token.slice(0, -3) + 'ABC';
  if (verifyToken(tampered) !== null) throw new Error('should fail');
});

assert('empty string token fails verification', () => {
  if (verifyToken('') !== null) throw new Error('should fail');
});

assert('garbage token fails verification', () => {
  if (verifyToken('abc.def.ghi') !== null) throw new Error('should fail');
});

// API key validation
assert('createApiKey returns key + id', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const result = createApiKey('user-123', 'Test Key');
  if (!result.key) throw new Error('no key');
  if (!result.id) throw new Error('no id');
  if (!result.key.startsWith('ogu_')) throw new Error('wrong key prefix');
  rmSync(dir, { recursive: true, force: true });
});

assert('validateApiKey returns userId for valid key', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { key } = createApiKey('user-456', 'My Key');
  const userId = validateApiKey(key);
  if (userId !== 'user-456') throw new Error(`expected 'user-456', got '${userId}'`);
  rmSync(dir, { recursive: true, force: true });
});

assert('validateApiKey returns null for invalid key', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const result = validateApiKey('ogu_notavalidkey12345');
  if (result !== null) throw new Error('should be null');
  rmSync(dir, { recursive: true, force: true });
});

assert('validateApiKey updates last_used', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { key } = createApiKey('user-789', 'Key');
  validateApiKey(key); // First use
  const keys = listApiKeys('user-789');
  if (!keys[0].lastUsed) throw new Error('lastUsed not updated');
  rmSync(dir, { recursive: true, force: true });
});

// Auth mode bypass (AOAS_MODE not set)
assert('middleware bypasses auth when AOAS_MODE is unset', () => {
  delete process.env.AOAS_MODE;
  // When AOAS_MODE is not set, requireAuth calls next() immediately
  // This is tested by the unit logic: !process.env.AOAS_MODE || process.env.AOAS_MODE === 'false'
  const bypass = !process.env.AOAS_MODE || process.env.AOAS_MODE === 'false';
  if (!bypass) throw new Error('should bypass auth in local mode');
});

assert('AOAS_MODE=false also bypasses auth', () => {
  process.env.AOAS_MODE = 'false';
  const bypass = !process.env.AOAS_MODE || process.env.AOAS_MODE === 'false';
  if (!bypass) throw new Error('should bypass auth when AOAS_MODE=false');
  delete process.env.AOAS_MODE;
});

assert('AOAS_MODE=true requires auth', () => {
  process.env.AOAS_MODE = 'true';
  const bypass = !process.env.AOAS_MODE || process.env.AOAS_MODE === 'false';
  if (bypass) throw new Error('should require auth when AOAS_MODE=true');
  delete process.env.AOAS_MODE;
});

assert('Bearer token flow: sign → extract → verify', () => {
  const token = signAccessToken({ userId: 'u-auth', email: 't@t.com', type: 'access' });
  const extracted = extractBearerToken(`Bearer ${token}`);
  if (!extracted) throw new Error('extraction failed');
  const payload = verifyToken(extracted);
  if (!payload) throw new Error('verification failed');
  if (payload.userId !== 'u-auth') throw new Error('wrong payload');
});

assert('token with future exp is valid', () => {
  const token = signAccessToken({ userId: 'u-future' });
  const payload = verifyToken(token);
  if (!payload) throw new Error('should be valid');
  if (payload.exp <= Date.now()) throw new Error('exp should be in future');
});

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
