import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * SC008 — no-sensitive-logging
 * Sensitive fields (password, token, secret, Authorization, apiKey, credential)
 * must not appear in log statements without redaction.
 *
 * A "log statement" is any call to console.log/error/warn/info, logger.*, winston.*, pino.*
 */

const LOG_CALL = /(?:console\.\w+|logger\.\w+|log\.\w+|winston\.\w+|pino\(\)?\.\w+)\s*\(/;
const SENSITIVE_FIELD = /(?:password|secret|token|apiKey|api_key|Authorization|credential|private_?key)/i;
const REDACTED = /\[REDACTED\]|redact|mask\(|scrub\(|\*{3,}|'xxxx'|"xxxx"/i;

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/\.(ts|mjs|js)$/) && !e.name.match(/\.(test|spec|d)\./)) {
        files.push(join(d, e.name));
      }
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const files = collectFiles(dir);
  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      if (!LOG_CALL.test(line)) continue;
      if (SENSITIVE_FIELD.test(line) && !REDACTED.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — sensitive field in log: ${line.trim().slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SC008',
      message: `${violations.length} sensitive field(s) logged without redaction`,
      detail: violations.slice(0, 10).join('\n')
    };
  }

  return { pass: true, code: 'SC008', message: `No sensitive fields in logs (${files.length} file(s) checked)` };
}
