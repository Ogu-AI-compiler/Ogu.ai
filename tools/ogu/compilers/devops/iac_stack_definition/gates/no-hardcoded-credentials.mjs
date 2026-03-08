/**
 * Gate: no-hardcoded-credentials (IAC005)
 * Scans all IaC files (.tf, .yaml, .ts, .py) for hardcoded credentials. Infrastructure
 * code that contains literal credentials gets committed to source control and is
 * preserved in git history indefinitely — it must use variable references or secret
 * managers instead.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SECRET_PATTERNS = [
  /(?:access_key|secret_key|api_key|password|token|credentials)\s*=\s*"[A-Za-z0-9+/]{16,}"/i,
  /AKIA[0-9A-Z]{16}/,    // AWS Access Key ID pattern
  /(?:aws_access_key_id|aws_secret_access_key)\s*=\s*"[^"]+"/i,
];

function getAllIaCFiles(dir) {
  const results = [];
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && !['node_modules', '.git', '.terraform'].includes(e.name)) {
        results.push(...getAllIaCFiles(join(dir, e.name)));
      } else if (/\.(tf|yaml|yml|ts|py)$/.test(e.name)) {
        results.push(join(dir, e.name));
      }
    }
  } catch { /* unreadable dir */ }
  return results;
}

export async function run({ dir }) {
  const files = getAllIaCFiles(dir);
  if (files.length === 0) {
    return { pass: true, code: 'IAC005', message: 'No IaC files found — skipped', skipped: true };
  }

  const violations = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed.startsWith('//')) return;
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(line)) {
          violations.push({
            file:    file.replace(dir + '/', ''),
            line:    i + 1,
            content: trimmed.slice(0, 80),
          });
          break;
        }
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'IAC005',
      message: `${violations.length} hardcoded credential(s) found in IaC files`,
      detail: {
        violations,
        hint: 'Use variable references (var.my_secret) or external secret managers (AWS Secrets Manager, Vault). Never put credentials in IaC code.',
      },
    };
  }

  return { pass: true, code: 'IAC005', message: `No hardcoded credentials in ${files.length} IaC file(s)` };
}
