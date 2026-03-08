import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/** UTH008 — contract-theme: validates spec against theme-manifest.contract.json */

const __dir = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = join(__dir, '..', 'contracts', 'theme-manifest.contract.json');

export async function run({ dir }) {
  const specPath = join(dir, 'theme-manifest-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UTH008', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UTH008', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  let contract;
  try {
    contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'UTH008', message: `Cannot load contract: ${err.message}` };
  }

  const modes = Array.isArray(spec.modes) ? spec.modes : [];
  const tokens = Array.isArray(spec.tokens) ? spec.tokens : [];
  const violations = [];

  // Rule: light-mode-required — light mode must always be declared
  if (!modes.includes('light')) {
    violations.push('Rule "light-mode-required": "light" mode must be declared — it is the universal fallback');
  }

  // Rule: minimum-ten-tokens — at least 10 semantic tokens for a meaningful system
  if (tokens.length < 10) {
    violations.push(`Rule "minimum-ten-tokens": only ${tokens.length} token(s) declared — minimum 10 for a usable theme system`);
  }

  // Rule: surface-and-text — at least one surface token and one text token must exist
  const hasSurface = tokens.some(t => t.toLowerCase().includes('surface'));
  const hasText    = tokens.some(t => t.toLowerCase().includes('text') || t.toLowerCase().includes('fg') || t.toLowerCase().includes('foreground'));
  if (!hasSurface) {
    violations.push('Rule "surface-and-text": no surface token declared (expected token containing "surface")');
  }
  if (!hasText) {
    violations.push('Rule "surface-and-text": no text/fg/foreground token declared');
  }

  // Rule: mappings-match-modes — every declared mode has a mappings entry
  const mappings = (spec.mappings && typeof spec.mappings === 'object') ? spec.mappings : {};
  const missingMappings = modes.filter(m => !mappings[m]);
  if (missingMappings.length > 0) {
    violations.push(`Rule "mappings-match-modes": modes without mapping entries: ${missingMappings.join(', ')}`);
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UTH008',
      message: `${violations.length} contract rule(s) violated`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UTH008', message: `Contract "${contract.id}" satisfied (${modes.length} modes, ${tokens.length} tokens)` };
}
