import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** FU002 — no-public-read-default: uploaded files must not be publicly readable by default */
export async function run({ dir }) {
  const specPath = join(dir, 'file-upload-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'FU002', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'FU002', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.upload_surfaces)) return { pass: true, code: 'FU002', message: 'No surfaces — gate skipped', skipped: true };

  const violations = [];
  for (const surface of spec.upload_surfaces) {
    const id = surface.id || '?';
    if (surface.public_read === true || surface.storage_acl === 'public-read' || surface.storage_acl === 'public') {
      violations.push(`Upload surface "${id}": public_read is enabled — uploaded files must be private by default. Use signed URLs for authorized access.`);
    }
  }

  if (violations.length > 0) return { pass: false, code: 'FU002', message: `${violations.length} upload surface(s) have public read enabled`, detail: violations.join('\n') };
  return { pass: true, code: 'FU002', message: `public_read is disabled for all ${spec.upload_surfaces.length} upload surface(s)` };
}
