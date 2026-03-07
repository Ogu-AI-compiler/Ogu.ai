/**
 * AoaS API Key Management
 * Keys are shown once, stored as HMAC-SHA256 hash.
 */
import { readTable, writeTable, randomUUID } from './db.mjs';
import { createHmac, randomBytes } from 'crypto';

const HMAC_KEY = 'api-key-hmac';

function hashKey(key) {
  return createHmac('sha256', HMAC_KEY).update(key).digest('hex');
}

function generateKey() {
  return 'ogu_' + randomBytes(32).toString('hex');
}

/**
 * Create a new API key for a user.
 * Returns { key (shown once), id, name, createdAt }
 */
export function createApiKey(userId, name) {
  if (!userId || !name) throw new Error('userId and name are required');
  const key = generateKey();
  const keys = readTable('api_keys');
  const entry = {
    id: randomUUID(),
    user_id: userId,
    name,
    key_hash: hashKey(key),
    created_at: new Date().toISOString(),
    last_used: null,
  };
  keys.push(entry);
  writeTable('api_keys', keys);
  return { key, id: entry.id, name, createdAt: entry.created_at };
}

/**
 * Revoke an API key by id (must belong to userId).
 */
export function revokeApiKey(userId, keyId) {
  const keys = readTable('api_keys');
  const key = keys.find(k => k.id === keyId && k.user_id === userId);
  if (!key) throw new Error('API key not found');
  writeTable('api_keys', keys.filter(k => k.id !== keyId));
}

/**
 * List API keys for a user (without hashes).
 */
export function listApiKeys(userId) {
  const keys = readTable('api_keys');
  return keys
    .filter(k => k.user_id === userId)
    .map(({ key_hash: _, ...k }) => ({ id: k.id, name: k.name, createdAt: k.created_at, lastUsed: k.last_used }));
}

/**
 * Validate an API key, returning userId or null.
 * Updates last_used timestamp.
 */
export function validateApiKey(key) {
  const hash = hashKey(key);
  const keys = readTable('api_keys');
  const idx = keys.findIndex(k => k.key_hash === hash);
  if (idx < 0) return null;
  keys[idx].last_used = new Date().toISOString();
  writeTable('api_keys', keys);
  return keys[idx].user_id;
}
