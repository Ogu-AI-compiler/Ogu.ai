/**
 * Gate UCS007 — variant-refs
 * Every slot with `experimentVariant` declared must reference a non-empty variantId string.
 * Escape hatch: slot.experimentVariant = null to explicitly mark as non-variant content.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'copy-structure-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UCS007',
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
      code: 'UCS007',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.content_slots) || spec.content_slots.length === 0) {
    return {
      pass: true,
      code: 'UCS007',
      message: 'No content_slots to check — gate skipped',
      skipped: true,
    };
  }

  // Find slots that declare experimentVariant (but not as null)
  const variantSlots = spec.content_slots.filter(
    s => Object.prototype.hasOwnProperty.call(s, 'experimentVariant') && s.experimentVariant !== null
  );

  if (variantSlots.length === 0) {
    return {
      pass: true,
      code: 'UCS007',
      message: 'variant-refs: no slots with experimentVariant declared — gate not applicable',
      skipped: true,
    };
  }

  const violations = [];

  for (const slot of variantSlots) {
    const slotLabel = `slot(id="${slot.id ?? 'unknown'}")`;
    const experimentVariant = slot.experimentVariant;

    // experimentVariant must be an object or string with a non-empty variantId
    if (typeof experimentVariant === 'object' && experimentVariant !== null) {
      // Object form: { variantId: "..." }
      if (
        typeof experimentVariant.variantId !== 'string' ||
        experimentVariant.variantId.trim() === ''
      ) {
        violations.push(
          `${slotLabel} experimentVariant is an object but variantId is missing or empty — ` +
          'set experimentVariant.variantId to a non-empty string, or set experimentVariant=null to opt out'
        );
      }
    } else if (typeof experimentVariant === 'string') {
      // String form: treated as variantId directly
      if (experimentVariant.trim() === '') {
        violations.push(
          `${slotLabel} experimentVariant is an empty string — ` +
          'use a non-empty variantId string or set experimentVariant=null to opt out'
        );
      }
    } else {
      violations.push(
        `${slotLabel} experimentVariant="${JSON.stringify(experimentVariant)}" is invalid — ` +
        'must be a non-empty string, an object with variantId, or null to opt out'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCS007',
      message: `${violations.length} variant reference violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UCS007',
    message: `variant-refs: all ${variantSlots.length} variant slot(s) have non-empty variantId`,
  };
}
