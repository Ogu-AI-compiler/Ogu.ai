import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** FU001 — spec-valid */
export async function run({ dir }) {
  const specPath = join(dir, 'file-upload-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'FU001', message: 'No file-upload-policy.json — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (err) { return { pass: false, code: 'FU001', message: 'file-upload-policy.json is not valid JSON', detail: err.message }; }

  const violations = [];
  if (!spec.feature) violations.push('Missing field: feature');
  if (!Array.isArray(spec.upload_surfaces) || spec.upload_surfaces.length === 0) violations.push('Missing field: upload_surfaces (non-empty array)');

  if (Array.isArray(spec.upload_surfaces)) {
    spec.upload_surfaces.forEach((s, i) => {
      if (!s.id) violations.push(`upload_surfaces[${i}]: missing field "id"`);
      if (!Array.isArray(s.allowed_mime_types) || s.allowed_mime_types.length === 0) violations.push(`upload_surfaces[${i}] (${s.id || '?'}): missing field "allowed_mime_types"`);
      if (!s.max_size_bytes && !s.max_size_mb) violations.push(`upload_surfaces[${i}] (${s.id || '?'}): must declare max_size_bytes or max_size_mb`);
    });
  }

  if (violations.length > 0) return { pass: false, code: 'FU001', message: `Spec validation failed: ${violations.length} violation(s)`, detail: violations.join('\n') };
  return { pass: true, code: 'FU001', message: `Spec valid — ${spec.upload_surfaces.length} upload surface(s)` };
}
