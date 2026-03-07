/**
 * Slice 400 — API Key Management
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

console.log('\n\x1b[1mSlice 400 — API Key Management\x1b[0m\n');

const { createApiKey, revokeApiKey, listApiKeys, validateApiKey } =
  await import('../../tools/studio/server/auth/api-keys.mjs');
const { readTable } = await import('../../tools/studio/server/auth/db.mjs');

function makeDataDir() {
  const dir = join(tmpdir(), `ogu-400-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

assert('createApiKey returns key + id + name + createdAt', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const result = createApiKey('user-1', 'My Key');
  if (!result.key) throw new Error('no key');
  if (!result.id) throw new Error('no id');
  if (result.name !== 'My Key') throw new Error('wrong name');
  if (!result.createdAt) throw new Error('no createdAt');
  rmSync(dir, { recursive: true, force: true });
});

assert('createApiKey key starts with ogu_', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { key } = createApiKey('user-1', 'K');
  if (!key.startsWith('ogu_')) throw new Error(`key should start with 'ogu_', got '${key.slice(0, 10)}'`);
  rmSync(dir, { recursive: true, force: true });
});

assert('createApiKey stores hash not plain key', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { key } = createApiKey('user-1', 'K');
  const stored = readTable('api_keys');
  if (stored.some(k => k.key_hash === key)) throw new Error('stored plain key!');
  rmSync(dir, { recursive: true, force: true });
});

assert('validateApiKey returns userId for valid key', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { key } = createApiKey('user-123', 'K');
  const result = validateApiKey(key);
  if (result !== 'user-123') throw new Error(`expected user-123, got ${result}`);
  rmSync(dir, { recursive: true, force: true });
});

assert('validateApiKey returns null for invalid key', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const result = validateApiKey('ogu_notarealkey00000000');
  if (result !== null) throw new Error('should be null');
  rmSync(dir, { recursive: true, force: true });
});

assert('listApiKeys returns keys for user (no hashes)', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  createApiKey('user-2', 'Key 1');
  createApiKey('user-2', 'Key 2');
  createApiKey('user-3', 'Key 3'); // Different user
  const keys = listApiKeys('user-2');
  if (keys.length !== 2) throw new Error(`expected 2, got ${keys.length}`);
  if (keys.some(k => k.key_hash)) throw new Error('should not include key_hash');
  rmSync(dir, { recursive: true, force: true });
});

assert('listApiKeys returns empty for user with no keys', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const keys = listApiKeys('user-nobody');
  if (keys.length !== 0) throw new Error('should be empty');
  rmSync(dir, { recursive: true, force: true });
});

assert('revokeApiKey removes key', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { key, id } = createApiKey('user-4', 'To Delete');
  revokeApiKey('user-4', id);
  const result = validateApiKey(key);
  if (result !== null) throw new Error('key should be invalid after revoke');
  rmSync(dir, { recursive: true, force: true });
});

assert('revokeApiKey throws for wrong user', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { id } = createApiKey('user-5', 'K');
  let threw = false;
  try { revokeApiKey('user-OTHER', id); }
  catch { threw = true; }
  if (!threw) throw new Error('should throw for wrong user');
  rmSync(dir, { recursive: true, force: true });
});

assert('validateApiKey updates last_used', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { key } = createApiKey('user-6', 'K');
  const before = listApiKeys('user-6')[0].lastUsed;
  if (before !== null) throw new Error('lastUsed should be null initially');
  validateApiKey(key);
  const after = listApiKeys('user-6')[0].lastUsed;
  if (!after) throw new Error('lastUsed should be set after use');
  rmSync(dir, { recursive: true, force: true });
});

assert('createApiKey throws when missing userId', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  let threw = false;
  try { createApiKey(null, 'K'); }
  catch { threw = true; }
  if (!threw) throw new Error('should throw');
  rmSync(dir, { recursive: true, force: true });
});

assert('multiple keys for same user all work', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const { key: k1 } = createApiKey('user-7', 'K1');
  const { key: k2 } = createApiKey('user-7', 'K2');
  if (validateApiKey(k1) !== 'user-7') throw new Error('k1 invalid');
  if (validateApiKey(k2) !== 'user-7') throw new Error('k2 invalid');
  rmSync(dir, { recursive: true, force: true });
});

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
