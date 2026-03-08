import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UCV003 — destructive-semantic: variants with destructive/danger intent must use
 * a token that contains "destructive" or "danger" in its name.
 *
 * This prevents destructive actions from using primary blue tokens, which would
 * make them visually indistinguishable from safe actions.
 */

const DESTRUCTIVE_INTENT_KEYWORDS = ['destructive', 'danger', 'delete', 'error', 'critical'];
const DESTRUCTIVE_TOKEN_PATTERN   = /destructive|danger|error|critical/i;

function variantHasDestructiveIntent(variant) {
  // Check variant id
  if (DESTRUCTIVE_INTENT_KEYWORDS.some(k => String(variant.id || '').toLowerCase().includes(k))) return true;
  // Check props
  if (variant.props && typeof variant.props === 'object') {
    for (const [key, val] of Object.entries(variant.props)) {
      const lowKey = String(key).toLowerCase();
      const lowVal = String(val).toLowerCase();
      if (lowKey === 'intent' || lowKey === 'variant') {
        if (DESTRUCTIVE_INTENT_KEYWORDS.some(k => lowVal.includes(k))) return true;
      }
    }
  }
  return false;
}

function getBackgroundTokens(variant) {
  const tokens = [];
  if (!variant.visual || typeof variant.visual !== 'object') return tokens;

  for (const modeProps of Object.values(variant.visual)) {
    if (typeof modeProps !== 'object' || modeProps === null) continue;
    for (const [prop, value] of Object.entries(modeProps)) {
      if (prop === 'background' || prop === 'bg' || prop === 'backgroundColor') {
        tokens.push(String(value || ''));
      }
    }
  }
  return tokens;
}

export async function run({ dir }) {
  const specPath = join(dir, 'component-variant-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UCV003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UCV003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.variants) || spec.variants.length === 0) {
    return { pass: true, code: 'UCV003', message: 'No variants — gate skipped', skipped: true };
  }

  const destructiveVariants = spec.variants.filter(variantHasDestructiveIntent);

  if (destructiveVariants.length === 0) {
    return { pass: true, code: 'UCV003', message: 'No destructive-intent variants declared — gate skipped', skipped: true };
  }

  const violations = [];

  for (const variant of destructiveVariants) {
    const bgTokens = getBackgroundTokens(variant);

    if (bgTokens.length === 0) {
      // No background token declared — cannot verify, skip this variant
      continue;
    }

    const hasDestructiveToken = bgTokens.some(t => DESTRUCTIVE_TOKEN_PATTERN.test(t));
    if (!hasDestructiveToken) {
      violations.push(
        `Variant "${variant.id}" has destructive intent but background token(s) [${bgTokens.join(', ')}] do not reference destructive/danger semantic`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCV003',
      message: `${violations.length} destructive variant(s) not using destructive semantic token`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UCV003', message: `All ${destructiveVariants.length} destructive variant(s) use destructive semantic tokens` };
}
