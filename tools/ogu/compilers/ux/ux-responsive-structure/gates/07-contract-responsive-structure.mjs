/**
 * Gate URS007 — contract-responsive-structure
 * Final contract check:
 * - version declared
 * - unique breakpoint names
 * - breakpoints sorted by minWidth ascending
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'responsive-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URS007',
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
      code: 'URS007',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  const violations = [];

  if (!spec.version) {
    violations.push('Contract: responsive-spec.json missing field "version"');
  }

  if (Array.isArray(spec.breakpoints)) {
    const seenNames = new Map();
    spec.breakpoints.forEach((bp, i) => {
      if (typeof bp.name !== 'string') return;
      if (seenNames.has(bp.name)) {
        violations.push(`Contract: Duplicate breakpoint name "${bp.name}"`);
      } else {
        seenNames.set(bp.name, true);
      }
    });

    const widths = spec.breakpoints
      .filter(bp => typeof bp.minWidth === 'number')
      .map(bp => bp.minWidth);

    for (let i = 1; i < widths.length; i++) {
      if (widths[i] < widths[i - 1]) {
        violations.push(
          `Contract: breakpoints are not sorted by minWidth ascending — index ${i - 1} (${widths[i - 1]}) > index ${i} (${widths[i]})`
        );
        break;
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URS007',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URS007',
    message: 'contract-responsive-structure: all contract rules satisfied',
  };
}
