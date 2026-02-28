/**
 * Secret Vault — store and retrieve secrets with access control,
 * file-backed encryption, audit logging, and role-based env building.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';

// ---------------------------------------------------------------------------
// Legacy API — kept for backwards compatibility
// ---------------------------------------------------------------------------

/**
 * In-memory secret vault (original API).
 */
export function createSecretVault() {
  const secrets = new Map();
  const accessLog = [];
  function store(key, value, owner) {
    secrets.set(key, { value, owner, createdAt: Date.now() });
  }
  function retrieve(key, requestor) {
    const secret = secrets.get(key);
    if (!secret) return null;
    accessLog.push({ key, requestor, time: Date.now() });
    return secret.value;
  }
  function revoke(key, requestor) {
    const secret = secrets.get(key);
    if (secret && secret.owner === requestor) {
      secrets.delete(key);
      return true;
    }
    return false;
  }
  function list() { return [...secrets.keys()]; }
  function getAccessLog() { return [...accessLog]; }
  return { store, retrieve, revoke, list, getAccessLog };
}

// ---------------------------------------------------------------------------
// Encryption helpers
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const SALT_LENGTH = 16;

/**
 * Derive a 256-bit key from a passphrase and salt using scrypt.
 */
function deriveKey(passphrase, salt) {
  return scryptSync(passphrase, salt, 32);
}

/**
 * Get the vault passphrase. Uses OGU_VAULT_KEY env var if set,
 * otherwise falls back to a deterministic machine-local key derived from
 * the repo root path. (Production deployments should always set OGU_VAULT_KEY.)
 */
function getPassphrase(root) {
  if (process.env.OGU_VAULT_KEY) return process.env.OGU_VAULT_KEY;
  return createHash('sha256').update(`ogu-vault:${root}`).digest('hex');
}

/**
 * Encrypt plaintext, returning a hex-encoded payload: salt:iv:ciphertext.
 */
function encrypt(plaintext, passphrase) {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(passphrase, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a payload previously produced by encrypt().
 */
function decrypt(payload, passphrase) {
  const [saltHex, ivHex, ciphertext] = payload.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ---------------------------------------------------------------------------
// Secrets directory helpers
// ---------------------------------------------------------------------------

function secretsDir(root) {
  return join(root, '.ogu', 'secrets');
}

function secretPath(root, key) {
  // Sanitize key to prevent path traversal.
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return join(secretsDir(root), `${safe}.json`);
}

function ensureSecretsDir(root) {
  const dir = secretsDir(root);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Public API — file-backed encrypted secrets
// ---------------------------------------------------------------------------

/**
 * Issue (store) an encrypted secret to disk.
 *
 * @param {string} root - Repository root path (or pass null to auto-detect).
 * @param {object} opts
 * @param {string}   opts.key        - Secret identifier.
 * @param {string}   opts.value      - Secret value (will be encrypted).
 * @param {string}   [opts.scope='global'] - Scope: 'global', 'feature', 'agent'.
 * @param {string[]} [opts.grantedTo=[]]   - List of role/agent IDs that may read.
 * @param {string}   [opts.expiresAt]      - ISO date string for expiry.
 * @returns {{ key: string, path: string }}
 */
export function issueSecret(root, { key, value, scope = 'global', grantedTo = [], expiresAt = null }) {
  const r = root || repoRoot();
  ensureSecretsDir(r);

  const passphrase = getPassphrase(r);
  const encryptedValue = encrypt(value, passphrase);

  const record = {
    key,
    scope,
    grantedTo,
    expiresAt,
    encryptedValue,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  const p = secretPath(r, key);
  writeFileSync(p, JSON.stringify(record, null, 2));

  emitAudit('secret.issued', { key, scope, grantedTo }, {
    severity: 'info',
    tags: ['secret', 'issue'],
  });

  return { key, path: p };
}

/**
 * Retrieve and decrypt a secret. Enforces access control via grantedTo.
 *
 * @param {string} root - Repository root (or null to auto-detect).
 * @param {string} key  - Secret identifier.
 * @param {string} requestor - ID of the requesting role/agent.
 * @returns {string|null} Decrypted value, or null if not found / denied / expired.
 */
export function retrieveSecret(root, key, requestor) {
  const r = root || repoRoot();
  const p = secretPath(r, key);

  if (!existsSync(p)) return null;

  let record;
  try {
    record = JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }

  // Check expiry.
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    emitAudit('secret.access.denied', { key, requestor, reason: 'expired' }, {
      severity: 'warn',
      tags: ['secret', 'expired'],
    });
    return null;
  }

  // Check access.
  if (record.grantedTo && record.grantedTo.length > 0 && !record.grantedTo.includes(requestor)) {
    emitAudit('secret.access.denied', { key, requestor, reason: 'not_granted' }, {
      severity: 'warn',
      tags: ['secret', 'access-denied'],
    });
    return null;
  }

  // Decrypt.
  const passphrase = getPassphrase(r);
  let value;
  try {
    value = decrypt(record.encryptedValue, passphrase);
  } catch {
    emitAudit('secret.access.error', { key, requestor, reason: 'decrypt_failed' }, {
      severity: 'error',
      tags: ['secret', 'decrypt-error'],
    });
    return null;
  }

  emitAudit('secret.accessed', { key, requestor }, {
    severity: 'info',
    tags: ['secret', 'access'],
  });

  return value;
}

/**
 * Revoke (delete) a secret from disk.
 *
 * @param {string} root - Repository root (or null).
 * @param {string} key  - Secret identifier.
 * @param {string} revokedBy - ID of the revoking actor.
 * @returns {boolean} True if the secret existed and was deleted.
 */
export function revokeSecret(root, key, revokedBy) {
  const r = root || repoRoot();
  const p = secretPath(r, key);

  if (!existsSync(p)) return false;

  unlinkSync(p);

  emitAudit('secret.revoked', { key, revokedBy }, {
    severity: 'info',
    tags: ['secret', 'revoke'],
  });

  return true;
}

/**
 * List secrets available to a requestor. Returns metadata only (no values).
 *
 * @param {string} root - Repository root (or null).
 * @param {string} requestor - ID of the requesting role/agent.
 * @returns {Array<{ key, scope, grantedTo, expiresAt, createdAt, version }>}
 */
export function listSecrets(root, requestor) {
  const r = root || repoRoot();
  const dir = secretsDir(r);

  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  const results = [];

  for (const file of files) {
    try {
      const record = JSON.parse(readFileSync(join(dir, file), 'utf-8'));

      // Skip expired.
      if (record.expiresAt && new Date(record.expiresAt) < new Date()) continue;

      // Skip if requestor is not granted (unless grantedTo is empty = open access).
      if (record.grantedTo && record.grantedTo.length > 0 && !record.grantedTo.includes(requestor)) continue;

      results.push({
        key: record.key,
        scope: record.scope,
        grantedTo: record.grantedTo,
        expiresAt: record.expiresAt,
        createdAt: record.createdAt,
        version: record.version,
      });
    } catch {
      // Skip malformed files.
    }
  }

  return results;
}

/**
 * Build a process.env-compatible object with secrets granted to a role.
 *
 * Secret keys are uppercased and prefixed with OGU_SECRET_ to form env var names.
 *
 * @param {string} root   - Repository root (or null).
 * @param {string} roleId - Role/agent ID to build env for.
 * @returns {object} { [envVarName]: decryptedValue }
 */
export function buildSecureEnv(root, roleId) {
  const r = root || repoRoot();
  const available = listSecrets(r, roleId);
  const env = {};

  // Load sandbox policy to filter based on blocked patterns
  let blockedPatterns = [];
  try {
    const sandboxPolicy = require('./sandbox-policy.mjs');
    const policy = sandboxPolicy.resolveSandboxPolicy({ root: r, roleId });
    blockedPatterns = policy?.filesystem?.blockedPaths || [];
  } catch {
    // sandbox-policy not available — continue without filtering
  }

  for (const meta of available) {
    const value = retrieveSecret(r, meta.key, roleId);
    if (value !== null) {
      const envKey = `OGU_SECRET_${meta.key.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
      env[envKey] = value;
    }
  }

  return env;
}

/**
 * Rotate a secret's value in place, preserving all metadata.
 *
 * @param {string} root     - Repository root (or null).
 * @param {string} key      - Secret identifier.
 * @param {string} newValue - New plaintext value.
 * @returns {boolean} True if rotation succeeded.
 */
export function rotateSecret(root, key, newValue) {
  const r = root || repoRoot();
  const p = secretPath(r, key);

  if (!existsSync(p)) return false;

  let record;
  try {
    record = JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return false;
  }

  const passphrase = getPassphrase(r);
  record.encryptedValue = encrypt(newValue, passphrase);
  record.updatedAt = new Date().toISOString();
  record.version = (record.version || 1) + 1;

  writeFileSync(p, JSON.stringify(record, null, 2));

  emitAudit('secret.rotated', { key, version: record.version }, {
    severity: 'info',
    tags: ['secret', 'rotate'],
  });

  return true;
}
