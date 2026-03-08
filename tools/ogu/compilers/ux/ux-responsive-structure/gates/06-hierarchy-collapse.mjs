/**
 * Gate URS006 — hierarchy-collapse
 * Any region listed in spec.collapsibleRegions must declare:
 * - collapsedAt (array of breakpoint names where it collapses)
 * - collapseType: "accordion" | "drawer" | "hidden" | "tab"
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_COLLAPSE_TYPES = new Set(['accordion', 'drawer', 'hidden', 'tab']);

export async function run({ dir }) {
  const specPath = join(dir, 'responsive-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URS006',
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
      code: 'URS006',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  const collapsibleRegions = spec.collapsibleRegions;

  if (!Array.isArray(collapsibleRegions) || collapsibleRegions.length === 0) {
    return {
      pass: true,
      code: 'URS006',
      message: 'hierarchy-collapse: no collapsibleRegions declared — gate not applicable',
    };
  }

  const violations = [];

  collapsibleRegions.forEach((region, i) => {
    const id = region.id || region.name || `collapsibleRegions[${i}]`;

    if (!Array.isArray(region.collapsedAt) || region.collapsedAt.length === 0) {
      violations.push(`Region "${id}" missing collapsedAt (array of breakpoint names)`);
    }

    if (typeof region.collapseType !== 'string') {
      violations.push(`Region "${id}" missing collapseType — must be "accordion", "drawer", "hidden", or "tab"`);
    } else if (!VALID_COLLAPSE_TYPES.has(region.collapseType)) {
      violations.push(
        `Region "${id}" collapseType="${region.collapseType}" is invalid — must be "accordion", "drawer", "hidden", or "tab"`
      );
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URS006',
      message: `${violations.length} collapsible region(s) missing required declarations`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URS006',
    message: `hierarchy-collapse: all ${collapsibleRegions.length} collapsible region(s) have valid declarations`,
  };
}
