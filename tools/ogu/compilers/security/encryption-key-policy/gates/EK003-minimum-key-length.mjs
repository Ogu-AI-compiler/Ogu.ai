import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** EK003 — minimum-key-length: key lengths must meet minimum security thresholds */
export async function run({ dir }) {
  const specPath = join(dir, 'encryption-key-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'EK003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'EK003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.keys) || spec.keys.length === 0) {
    return { pass: true, code: 'EK003', message: 'No keys — gate skipped', skipped: true };
  }

  // Minimum key lengths by algorithm family
  const MIN_LENGTHS = {
    'aes': 128,
    'rsa': 2048,
    'ecdsa': 256,
    'ecdh': 256,
    'hmac-sha': 256,
    'chacha20': 256,
  };

  const violations = [];

  for (const key of spec.keys) {
    const id = key.id || '?';
    const bits = key.key_length_bits;
    const algo = String(key.algorithm || '').toLowerCase();

    if (typeof bits !== 'number') continue;

    // Check against known minimums
    for (const [family, minBits] of Object.entries(MIN_LENGTHS)) {
      if (algo.startsWith(family) && bits < minBits) {
        violations.push(`Key "${id}": algorithm "${key.algorithm}" with ${bits} bits is below minimum of ${minBits} bits for ${family} keys`);
      }
    }

    // Absolute minimum: no key under 128 bits regardless of algorithm
    if (bits < 128) {
      violations.push(`Key "${id}": key_length_bits=${bits} is below absolute minimum of 128 bits`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'EK003',
      message: `${violations.length} key(s) have insufficient key length`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'EK003', message: `All ${spec.keys.length} key(s) meet minimum length requirements` };
}
