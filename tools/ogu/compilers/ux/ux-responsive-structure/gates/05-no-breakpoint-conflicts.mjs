/**
 * Gate URS005 — no-breakpoint-conflicts
 * No two breakpoints may have the same minWidth.
 * Duplicate breakpoint boundaries create undefined responsive behavior.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'responsive-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URS005',
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
      code: 'URS005',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.breakpoints) || spec.breakpoints.length < 2) {
    return {
      pass: true,
      code: 'URS005',
      message: 'no-breakpoint-conflicts: fewer than 2 breakpoints — no conflict possible',
    };
  }

  const seenWidths = new Map();
  const violations = [];

  spec.breakpoints.forEach((bp, i) => {
    if (typeof bp.minWidth !== 'number') return;
    const key = bp.minWidth;
    if (seenWidths.has(key)) {
      violations.push(
        `Duplicate minWidth=${key}px: breakpoint "${seenWidths.get(key)}" and "${bp.name || `breakpoints[${i}]`}"`
      );
    } else {
      seenWidths.set(key, bp.name || `breakpoints[${i}]`);
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URS005',
      message: `${violations.length} breakpoint(s) share the same minWidth`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URS005',
    message: `no-breakpoint-conflicts: all ${spec.breakpoints.length} breakpoints have unique minWidth values`,
  };
}
