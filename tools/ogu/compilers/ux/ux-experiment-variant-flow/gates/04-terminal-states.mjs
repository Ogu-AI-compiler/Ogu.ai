/**
 * Gate UEV004 — terminal-states
 * Every variant must declare terminals array with at least one terminal:
 * { type: "success"|"failure"|"abandoned", description: string }
 * Variants with no defined terminal outcome cannot be analyzed.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_TERMINAL_TYPES = new Set(['success', 'failure', 'abandoned']);

export async function run({ dir }) {
  const specPath = join(dir, 'experiment-variant-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UEV004',
      message: 'experiment-variant-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UEV004',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.variants)) {
    return {
      pass: true,
      code: 'UEV004',
      message: 'No variants array — skipped',
      skipped: true,
    };
  }

  const violations = [];

  spec.variants.forEach((v, i) => {
    const id = v.id || `variants[${i}]`;

    if (!Array.isArray(v.terminals) || v.terminals.length === 0) {
      violations.push(`Variant "${id}" missing terminals array or has no terminals — at least one terminal outcome is required`);
      return;
    }

    v.terminals.forEach((term, j) => {
      if (typeof term.type !== 'string') {
        violations.push(`Variant "${id}" terminals[${j}] missing type — must be "success", "failure", or "abandoned"`);
      } else if (!VALID_TERMINAL_TYPES.has(term.type)) {
        violations.push(
          `Variant "${id}" terminals[${j}] type="${term.type}" is invalid — must be "success", "failure", or "abandoned"`
        );
      }
      if (typeof term.description !== 'string' || term.description.trim() === '') {
        violations.push(`Variant "${id}" terminals[${j}] missing description (string)`);
      }
    });
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UEV004',
      message: `${violations.length} terminal state issue(s) across variants`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UEV004',
    message: `terminal-states: all ${spec.variants.length} variant(s) have valid terminal states`,
  };
}
