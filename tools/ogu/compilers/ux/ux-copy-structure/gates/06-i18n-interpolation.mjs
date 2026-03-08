/**
 * Gate UCS006 — i18n-interpolation
 * Every string in `content` fields that contains a placeholder pattern ({{...}} or {key})
 * must have a corresponding entry in the slot's `placeholders` array with a matching key.
 * Mismatched placeholders cause runtime i18n failures.
 *
 * Per-slot evaluation — a placeholder key valid in slot A does not satisfy slot B.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Matches {{key}} and {key} patterns — captures the inner key
const PLACEHOLDER_PATTERN = /\{\{?\s*([\w.-]+)\s*\}?\}/g;

function extractPlaceholderKeys(text) {
  const keys = [];
  let match;
  PLACEHOLDER_PATTERN.lastIndex = 0;
  while ((match = PLACEHOLDER_PATTERN.exec(text)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

function getContentStrings(slot) {
  const strings = [];

  // Direct content field on the slot
  if (typeof slot.content === 'string') {
    strings.push({ source: 'content', text: slot.content });
  }

  // content fields inside stateCoverage entries
  if (Array.isArray(slot.stateCoverage)) {
    for (const stateEntry of slot.stateCoverage) {
      if (typeof stateEntry.content === 'string') {
        strings.push({ source: `stateCoverage[state="${stateEntry.state}"].content`, text: stateEntry.content });
      }
    }
  }

  return strings;
}

export async function run({ dir }) {
  const specPath = join(dir, 'copy-structure-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UCS006',
      message: 'copy-structure-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UCS006',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.content_slots) || spec.content_slots.length === 0) {
    return {
      pass: true,
      code: 'UCS006',
      message: 'No content_slots to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  // Evaluate each slot independently (per-call-site evaluation)
  for (const slot of spec.content_slots) {
    const slotLabel = `slot(id="${slot.id ?? 'unknown'}")`;

    // Build the set of declared placeholder keys for THIS slot
    const declaredKeys = new Set();
    if (Array.isArray(slot.placeholders)) {
      for (const ph of slot.placeholders) {
        if (typeof ph === 'object' && ph !== null && typeof ph.key === 'string') {
          declaredKeys.add(ph.key);
        }
      }
    }

    // Check each content string in this slot
    const contentStrings = getContentStrings(slot);

    for (const { source, text } of contentStrings) {
      const usedKeys = extractPlaceholderKeys(text);
      for (const key of usedKeys) {
        if (!declaredKeys.has(key)) {
          violations.push(
            `${slotLabel}.${source} uses placeholder "{${key}}" ` +
            'but no matching entry in slot.placeholders with key="' + key + '" — ' +
            'i18n interpolation will fail at runtime'
          );
        }
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCS006',
      message: `${violations.length} i18n interpolation mismatch(es)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UCS006',
    message: 'i18n-interpolation: all placeholder keys in content strings are declared in placeholders',
  };
}
