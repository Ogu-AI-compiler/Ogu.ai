import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** FU006 — content-type-validated: upload surfaces must declare allowed MIME types, not rely solely on extension checks */
export async function run({ dir }) {
  const specPath = join(dir, 'file-upload-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'FU006', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'FU006', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.upload_surfaces)) return { pass: true, code: 'FU006', message: 'No surfaces — gate skipped', skipped: true };

  const violations = [];
  for (const surface of spec.upload_surfaces) {
    const id = surface.id || '?';
    const hasMimeTypes = Array.isArray(surface.allowed_mime_types) && surface.allowed_mime_types.length > 0;
    const hasContentTypeCheck = surface.validate_content_type === true || surface.server_side_mime_check === true;

    if (!hasMimeTypes && !hasContentTypeCheck) {
      violations.push(`Upload surface "${id}": missing allowed_mime_types[] — MIME type must be validated server-side, not inferred from extension`);
    }
  }

  if (violations.length > 0) {
    return { pass: false, code: 'FU006', message: `${violations.length} upload surface(s) missing server-side MIME type validation`, detail: violations.join('\n') };
  }
  return { pass: true, code: 'FU006', message: `Content-type validation declared for all ${spec.upload_surfaces.length} upload surface(s)` };
}
