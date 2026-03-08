import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * SR002 — timeout-enforced
 * Every outbound HTTP request path must use a timeout via AbortSignal or timeout option.
 * fetch() without AbortSignal is a fire-and-forget that can hang forever.
 */

const FETCH_PATTERN = /\bfetch\s*\(/;
const ABORT_SIGNAL_PATTERN = /AbortSignal|signal\s*:|AbortController/;
const TIMEOUT_OPTION_PATTERN = /timeout\s*:|timeoutMs|requestTimeout/;
const AXIOS_TIMEOUT_PATTERN = /timeout\s*:/;

function findHttpFiles(dir) {
  const results = [];
  const httpDirs = ['src/lib/http', 'src/http', 'lib/http', 'http'];
  for (const rel of httpDirs) {
    const p = join(dir, rel);
    if (!existsSync(p)) continue;
    try {
      readdirSync(p, { withFileTypes: true }).forEach(e => {
        if (!e.isDirectory() && e.name.match(/\.(ts|js)$/)) results.push(join(p, e.name));
      });
    } catch { /* skip */ }
  }
  // fallback: look for httpClient.ts anywhere
  if (results.length === 0) {
    function walk(d) {
      let entries;
      try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (e.isDirectory()) {
          if (['node_modules', 'dist', '.ogu', '.git'].includes(e.name)) continue;
          walk(join(d, e.name));
        } else if (e.name.match(/[Hh]ttp[Cc]lient|[Ff]etcher|[Hh]ttp/)) {
          results.push(join(d, e.name));
        }
      }
    }
    walk(dir);
  }
  return results;
}

export async function run({ dir }) {
  const httpFiles = findHttpFiles(dir);
  if (httpFiles.length === 0) {
    return {
      pass: false, code: 'SR002',
      message: 'HTTP client files not found (expected src/lib/http/httpClient.ts or similar)',
      detail: 'Create src/lib/http/httpClient.ts with timeout enforcement on all requests'
    };
  }

  const violations = [];

  for (const file of httpFiles) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      if (FETCH_PATTERN.test(line)) {
        // Check context around this line for signal or timeout
        const context = lines.slice(Math.max(0, i - 3), i + 5).join('\n');
        const hasTimeout = ABORT_SIGNAL_PATTERN.test(context) || TIMEOUT_OPTION_PATTERN.test(context);
        if (!hasTimeout) {
          violations.push(`${file.replace(dir + '/', '')}:${i + 1} — fetch() without AbortSignal: ${line.trim()}`);
        }
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'SR002',
      message: `${violations.length} fetch() call(s) without timeout/AbortSignal`,
      detail: violations.join('\n') + '\n\nFix: Add signal: AbortSignal.timeout(ms) to every fetch call'
    };
  }

  return {
    pass: true, code: 'SR002',
    message: `All HTTP requests have timeout enforcement (${httpFiles.length} file(s) checked)`
  };
}
