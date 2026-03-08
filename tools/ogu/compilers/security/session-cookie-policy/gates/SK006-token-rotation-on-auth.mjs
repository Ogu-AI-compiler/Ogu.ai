import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SK006 — token-rotation-on-auth: session tokens must be rotated after successful login to prevent session fixation attacks */
export async function run({ dir }) {
  const specPath = join(dir, 'session-cookie-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'SK006', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'SK006', message: 'Invalid JSON — gate skipped', skipped: true }; }

  const session = spec.session || {};

  const rotates =
    session.rotate_on_login === true ||
    session.regenerate_on_auth === true ||
    session.token_rotation === true ||
    session.fixation_protection === true;

  if (!rotates) {
    return {
      pass: false,
      code: 'SK006',
      message: 'Session token rotation on login not declared — set session.rotate_on_login: true to prevent session fixation attacks',
    };
  }

  return { pass: true, code: 'SK006', message: 'Session token rotation on login is declared' };
}
