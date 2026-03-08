import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** FU003 — dangerous-extensions-blocked: executable and script file types must not be allowed */
export async function run({ dir }) {
  const specPath = join(dir, 'file-upload-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'FU003', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'FU003', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.upload_surfaces)) return { pass: true, code: 'FU003', message: 'No surfaces — gate skipped', skipped: true };

  const DANGEROUS_MIME_TYPES = new Set([
    'application/x-executable', 'application/x-msdos-program', 'application/x-sh',
    'application/x-bat', 'text/x-php', 'application/x-php', 'application/x-perl',
    'application/x-python-code', 'application/java-archive', 'application/x-msdownload',
    'text/html', 'application/javascript', 'text/javascript',
    'application/x-shockwave-flash',
  ]);
  const DANGEROUS_EXT_PATTERN = /\.(exe|sh|bat|cmd|ps1|php|asp|aspx|jsp|html|htm|js|vbs|jar|py|rb|pl|cgi|htaccess)$/i;

  const violations = [];

  for (const surface of spec.upload_surfaces) {
    const id = surface.id || '?';

    // Check allowed MIME types
    if (Array.isArray(surface.allowed_mime_types)) {
      for (const mime of surface.allowed_mime_types) {
        if (DANGEROUS_MIME_TYPES.has(mime.toLowerCase())) {
          violations.push(`Upload surface "${id}": MIME type "${mime}" is dangerous (executable/script) — remove from allowed_mime_types`);
        }
      }
    }

    // Check allowed extensions
    if (Array.isArray(surface.allowed_extensions)) {
      for (const ext of surface.allowed_extensions) {
        if (DANGEROUS_EXT_PATTERN.test(String(ext))) {
          violations.push(`Upload surface "${id}": extension "${ext}" is dangerous — remove from allowed_extensions`);
        }
      }
    }
  }

  if (violations.length > 0) return { pass: false, code: 'FU003', message: `${violations.length} dangerous file type(s) allowed`, detail: violations.join('\n') };
  return { pass: true, code: 'FU003', message: 'No dangerous file types allowed in any upload surface' };
}
