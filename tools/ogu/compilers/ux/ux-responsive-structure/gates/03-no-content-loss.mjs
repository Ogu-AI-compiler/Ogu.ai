/**
 * Gate URS003 — no-content-loss
 * Any region with hidden:true at a breakpoint must declare:
 * - disclosureTarget (string — id of a control that reveals it), OR
 * - hiddenIntentional:true
 * Hiding content without a disclosure mechanism is a violation.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'responsive-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URS003',
      message: 'responsive-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'URS003',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  const regions = Array.isArray(spec.regions) ? spec.regions : [];

  if (regions.length === 0) {
    return {
      pass: true,
      code: 'URS003',
      message: 'no-content-loss: no regions declared — gate not applicable',
    };
  }

  const violations = [];

  regions.forEach(region => {
    const id = region.id || region.name || 'unknown';
    const breakpointVisibility = region.breakpointVisibility || {};

    Object.entries(breakpointVisibility).forEach(([bpName, visibility]) => {
      if (typeof visibility === 'object' && visibility !== null && visibility.hidden === true) {
        const hasDisclosure = typeof visibility.disclosureTarget === 'string' && visibility.disclosureTarget.trim() !== '';
        const isIntentional = visibility.hiddenIntentional === true;
        if (!hasDisclosure && !isIntentional) {
          violations.push(
            `Region "${id}" is hidden at breakpoint "${bpName}" but has no disclosureTarget or hiddenIntentional:true`
          );
        }
      }
      if (visibility === 'hidden') {
        if (!(region.disclosureTarget || region.hiddenIntentional)) {
          violations.push(
            `Region "${id}" is hidden at breakpoint "${bpName}" but has no disclosureTarget or hiddenIntentional:true on the region`
          );
        }
      }
    });
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URS003',
      message: `${violations.length} region(s) hidden without a disclosure mechanism`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URS003',
    message: `no-content-loss: all ${regions.length} region(s) have valid visibility declarations`,
  };
}
