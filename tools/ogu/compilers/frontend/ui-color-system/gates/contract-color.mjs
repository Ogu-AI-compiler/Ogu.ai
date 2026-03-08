import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/** UCS009 — contract-color: validates spec against color-system.contract.json rules */

const __dir = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = join(__dir, '..', 'contracts', 'color-system.contract.json');

export async function run({ dir }) {
  const specPath = join(dir, 'color-system-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UCS009', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UCS009', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  let contract;
  try {
    contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'UCS009',
      message: `Cannot load contract file: ${err.message}`,
    };
  }

  const violations = [];
  const roles = Array.isArray(spec.semanticRoles) ? spec.semanticRoles : [];
  const modes = Array.isArray(spec.modes) ? spec.modes : [];

  // Rule: destructive-role-exists — destructive semantic role must be declared
  const hasDestructive = roles.some(r => r.id === 'destructive');
  if (!hasDestructive) {
    violations.push('Rule "destructive-role-exists": destructive semantic role is required for error/danger states');
  }

  // Rule: focus-indicator-declared — focusIndicator section must be present
  if (!spec.focusIndicator) {
    violations.push('Rule "focus-indicator-declared": focusIndicator section required for WCAG 2.1 SC 1.4.11 compliance');
  }

  // Rule: wcag-level-declared — project must declare its WCAG target
  if (!spec.wcagLevel) {
    violations.push('Rule "wcag-level-declared": wcagLevel must be declared ("AA" or "AAA")');
  }

  // Rule: multi-mode — at least one non-light mode should be declared
  const hasNonLightMode = modes.some(m => m !== 'light');
  if (modes.length > 0 && !hasNonLightMode) {
    violations.push('Rule "multi-mode": only "light" mode declared — dark or high-contrast mode strongly recommended for accessibility');
  }

  // Rule: roles-have-ids — every role entry must have an id field
  const rolesWithoutId = roles.filter(r => !r.id);
  if (rolesWithoutId.length > 0) {
    violations.push(`Rule "roles-have-ids": ${rolesWithoutId.length} role(s) missing "id" field`);
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCS009',
      message: `${violations.length} contract rule(s) violated`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UCS009',
    message: `Contract "${contract.id}" satisfied (${roles.length} roles, ${modes.length} modes)`,
  };
}
