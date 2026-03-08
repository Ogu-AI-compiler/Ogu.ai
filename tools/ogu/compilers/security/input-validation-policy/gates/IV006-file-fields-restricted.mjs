import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** IV006 — file-fields-restricted: file upload fields must declare allowed MIME types and size limit */
export async function run({ dir }) {
  const specPath = join(dir, 'input-validation-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'IV006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'IV006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.fields)) {
    return { pass: true, code: 'IV006', message: 'No fields — gate skipped', skipped: true };
  }

  const FILE_TYPES = new Set(['file', 'upload', 'image', 'document', 'attachment', 'binary', 'blob', 'avatar', 'photo', 'video', 'audio']);
  const fileFields = spec.fields.filter(f => FILE_TYPES.has(String(f.type || '').toLowerCase()) || f.is_file === true);

  if (fileFields.length === 0) {
    return { pass: true, code: 'IV006', message: 'No file fields — gate skipped', skipped: true };
  }

  const DANGEROUS_EXTENSIONS = new Set(['.exe', '.sh', '.bat', '.cmd', '.ps1', '.php', '.asp', '.aspx', '.jsp', '.html', '.htm', '.js', '.vbs', '.jar', '.py', '.rb']);
  const violations = [];

  for (const field of fileFields) {
    const id = field.id || '?';

    if (!Array.isArray(field.allowed_mime_types) || field.allowed_mime_types.length === 0) {
      violations.push(`File field "${id}": must declare allowed_mime_types as a non-empty array`);
    }

    if (typeof field.max_size_bytes !== 'number' && typeof field.max_size_mb !== 'number') {
      violations.push(`File field "${id}": must declare max_size_bytes or max_size_mb`);
    }

    // Check if allowed extensions include dangerous types
    if (Array.isArray(field.allowed_extensions)) {
      for (const ext of field.allowed_extensions) {
        if (DANGEROUS_EXTENSIONS.has(String(ext).toLowerCase())) {
          violations.push(`File field "${id}": allowed_extensions includes dangerous extension "${ext}" — executable and script files must be blocked`);
        }
      }
    }
  }

  if (violations.length > 0) {
    return { pass: false, code: 'IV006', message: `${violations.length} file field(s) missing or invalid restrictions`, detail: violations.join('\n') };
  }

  return { pass: true, code: 'IV006', message: `All ${fileFields.length} file field(s) have MIME type and size restrictions` };
}
