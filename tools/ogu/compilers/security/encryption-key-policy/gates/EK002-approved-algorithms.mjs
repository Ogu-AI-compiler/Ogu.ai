import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** EK002 — approved-algorithms: only approved modern cryptographic algorithms allowed */
export async function run({ dir }) {
  const specPath = join(dir, 'encryption-key-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'EK002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'EK002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.keys) || spec.keys.length === 0) {
    return { pass: true, code: 'EK002', message: 'No keys — gate skipped', skipped: true };
  }

  // Approved algorithms (NIST-recommended, 2024+)
  const APPROVED_SYMMETRIC = new Set([
    'aes-256-gcm', 'aes-128-gcm', 'aes-256-cbc', 'aes-128-cbc',
    'chacha20-poly1305', 'aes-256', 'aes-128',
  ]);
  const APPROVED_ASYMMETRIC = new Set([
    'rsa-2048', 'rsa-3072', 'rsa-4096',
    'ecdsa-p256', 'ecdsa-p384', 'ecdsa-p521',
    'ed25519', 'ed448',
    'ecdh-p256', 'ecdh-p384',
    'x25519', 'x448',
  ]);
  const APPROVED_HASHING = new Set([
    'sha-256', 'sha-384', 'sha-512', 'sha3-256', 'sha3-384', 'sha3-512',
    'hmac-sha256', 'hmac-sha384', 'hmac-sha512',
    'argon2id', 'bcrypt', 'scrypt',
  ]);
  const DEPRECATED = new Set([
    'md5', 'sha1', 'sha-1', 'des', '3des', 'triple-des', 'rc4', 'rc2',
    'aes-256-ecb', 'aes-128-ecb', 'rsa-1024', 'dsa-1024',
  ]);

  const ALL_APPROVED = new Set([...APPROVED_SYMMETRIC, ...APPROVED_ASYMMETRIC, ...APPROVED_HASHING]);
  const violations = [];

  for (const key of spec.keys) {
    const id = key.id || '?';
    const algo = String(key.algorithm || '').toLowerCase();

    if (DEPRECATED.has(algo)) {
      violations.push(`Key "${id}": algorithm "${key.algorithm}" is deprecated and insecure — use an approved algorithm`);
      continue;
    }

    if (!ALL_APPROVED.has(algo)) {
      violations.push(`Key "${id}": algorithm "${key.algorithm}" is not on the approved list — verify it is NIST-approved and update the policy if needed`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'EK002',
      message: `${violations.length} key(s) use unapproved or deprecated algorithm(s)`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'EK002', message: `All ${spec.keys.length} key(s) use approved algorithms` };
}
