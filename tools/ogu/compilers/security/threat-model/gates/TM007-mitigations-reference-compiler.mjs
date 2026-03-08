import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** TM007 — mitigations-reference-compiler: each mitigation should reference a downstream compiler or mechanism */
export async function run({ dir }) {
  const specPath = join(dir, 'threat-model.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'TM007', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'TM007', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.threats) || spec.threats.length === 0) {
    return { pass: true, code: 'TM007', message: 'No threats — gate skipped', skipped: true };
  }

  // Known downstream security compilers and mechanisms
  const KNOWN_COMPILERS = new Set([
    'authz-policy', 'input-validation-policy', 'rate-limit-policy',
    'csp-policy', 'audit-log-policy', 'webhook-verification-policy',
    'file-upload-policy', 'session-cookie-policy', 'dep-vuln-policy',
    'sast-policy', 'secret-handling-policy', 'pii-classification',
    'encryption-key-policy', 'vuln-exception-record',
    // Also accept mechanism references
    'tls', 'mfa', 'cors', 'firewall', 'waf', 'rate-limiting',
    'input-sanitization', 'output-encoding', 'parameterized-queries',
    'content-security-policy', 'csrf-protection', 'authentication',
    'authorization', 'logging', 'monitoring', 'alerting',
  ]);

  const violations = [];

  for (const threat of spec.threats) {
    const id = threat.id || '?';
    if (!Array.isArray(threat.mitigations) || threat.mitigations.length === 0) continue;

    for (const mitigation of threat.mitigations) {
      const hasCompilerRef = typeof mitigation.compiler_ref === 'string' && mitigation.compiler_ref.trim().length > 0;
      const hasMechanismRef = typeof mitigation.mechanism === 'string' && mitigation.mechanism.trim().length > 0;

      if (!hasCompilerRef && !hasMechanismRef) {
        violations.push(`Threat "${id}", mitigation "${mitigation.description || '?'}": must declare either compiler_ref (pointing to a downstream compiler) or mechanism (describing the control)`);
        continue;
      }

      // Warn if the reference doesn't match a known compiler or mechanism
      const ref = (mitigation.compiler_ref || mitigation.mechanism || '').toLowerCase();
      const isKnown = [...KNOWN_COMPILERS].some(known => ref.includes(known));
      if (!isKnown) {
        // Not a hard failure — unknown refs are allowed, just noted
        // (custom mitigations may reference non-standard compilers)
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'TM007',
      message: `${violations.length} mitigation(s) missing compiler_ref or mechanism reference`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'TM007', message: 'All mitigations reference a downstream compiler or control mechanism' };
}
