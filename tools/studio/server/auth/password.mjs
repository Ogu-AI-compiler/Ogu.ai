/**
 * AoaS Password utilities — bcrypt-equivalent using Node.js crypto.scrypt
 */
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

const SALT_LEN = 16;
const KEY_LEN = 64;
const ROUNDS = 16384; // N param for scrypt (equivalent to bcrypt 12)
const SEPARATOR = ':';

/**
 * Hash a plain-text password.
 * Returns: "{salt_hex}:{hash_hex}"
 */
export function hashPassword(plain) {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(plain, salt, KEY_LEN, { N: ROUNDS });
  return salt.toString('hex') + SEPARATOR + hash.toString('hex');
}

/**
 * Verify a plain-text password against a stored hash.
 */
export function verifyPassword(plain, stored) {
  try {
    const [saltHex, hashHex] = stored.split(SEPARATOR);
    if (!saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const storedHash = Buffer.from(hashHex, 'hex');
    const derivedHash = scryptSync(plain, salt, KEY_LEN, { N: ROUNDS });
    return timingSafeEqual(storedHash, derivedHash);
  } catch {
    return false;
  }
}
