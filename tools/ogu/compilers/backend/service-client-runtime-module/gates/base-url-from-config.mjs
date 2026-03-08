import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * SR003 — base-url-from-config
 * Base URLs must come from config, not hardcoded strings.
 * Detects literal https?:// URLs assigned directly in http client files.
 */

const HARDCODED_URL_PATTERN = /['"`]https?:\/\/[a-zA-Z0-9][^'"` ]+['"`]/;
const CONFIG_IMPORT_PATTERN = /from ['"].*config|from ['"].*env/;

function findHttpFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.ogu', '.git', 'test', '__tests__'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/[Hh]ttp[Cc]lient|[Ff]etcher|httpClient|baseUrl/)) {
        results.push(join(d, e.name));
      }
    }
  }
  // Prefer lib/http directory
  const httpDir = join(dir, 'src', 'lib', 'http');
  if (existsSync(httpDir)) {
    readdirSync(httpDir, { withFileTypes: true }).forEach(e => {
      if (!e.isDirectory()) results.push(join(httpDir, e.name));
    });
    return results;
  }
  walk(dir);
  return results;
}

export async function run({ dir }) {
  const httpFiles = findHttpFiles(dir);
  if (httpFiles.length === 0) {
    return {
      pass: true, code: 'SR003',
      message: 'No HTTP client files found — base-url-from-config gate skipped',
      skipped: true
    };
  }

  const violations = [];

  for (const file of httpFiles) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');

    // Check for hardcoded URLs (not in comments, not in test files)
    if (file.includes('.test.') || file.includes('.spec.')) continue;

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (HARDCODED_URL_PATTERN.test(line)) {
        // Allow localhost/127.0.0.1 in dev configs with a comment
        if (/localhost|127\.0\.0\.1/.test(line) && /default|dev|fallback/.test(line)) return;
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — hardcoded URL: ${trimmed.slice(0, 80)}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'SR003',
      message: `${violations.length} hardcoded base URL(s) found`,
      detail: violations.join('\n') + '\n\nFix: import { env } from "../config" and use env.SERVICE_BASE_URL'
    };
  }

  return {
    pass: true, code: 'SR003',
    message: `No hardcoded base URLs — all URLs come from config`
  };
}
