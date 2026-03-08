import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * SS005 — no-prod-data
 * Seeds must not contain real production data patterns.
 * Checks for: real-looking SSNs, credit card patterns, real email domains of known companies,
 * phone numbers in E.164 format with real area codes.
 *
 * Test data must be obviously fake (test@example.com, 555-xxxx, etc.)
 */

const SUSPICIOUS_PATTERNS = [
  { name: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  { name: 'credit card', pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/ },
  { name: 'real email domain', pattern: /['"][\w.+]+@(?:gmail|yahoo|hotmail|outlook|company|corp)\.[a-z]+['"]/i },
  { name: 'real phone', pattern: /['"](?:\+1)?[2-9]\d{9}['"]/ },
];

// Allow obviously fake test values
const TEST_SAFE = /test|example|fake|dummy|seed|mock|sample|placeholder|foo|bar/i;

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      if (f.isDirectory()) { if (!['node_modules','dist','.git'].includes(f.name)) walk(join(d,f.name)); }
      else if (f.name.match(/\.(ts|mjs|js|json)$/) && !f.name.match(/\.(test|spec|d)\./)) files.push(join(d,f.name));
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const files = collectFiles(dir);
  const violations = [];

  for (const file of files) {
    // Skip spec files and artifact files
    if (file.endsWith('-spec.json') || file.endsWith('-artifact.json')) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (TEST_SAFE.test(line)) continue; // safe test data
      for (const { name, pattern } of SUSPICIOUS_PATTERNS) {
        if (pattern.test(line)) {
          violations.push(`${file.replace(dir+'/', '')}:${i+1} — suspicious ${name} pattern: ${line.trim().slice(0,80)}`);
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SS005',
      message: `${violations.length} suspicious production data pattern(s) in seed`,
      detail: violations.slice(0,10).join('\n') + '\n\nUse obviously fake test data: test@example.com, 555-0100, seed-user-001'
    };
  }

  return { pass: true, code: 'SS005', message: `No production data patterns detected (${files.length} file(s))` };
}
