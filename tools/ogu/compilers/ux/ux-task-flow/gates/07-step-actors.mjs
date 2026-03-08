/**
 * Gate UTK007 — step-actors
 * Every step must have an `actor` field: "user" | "system" | "both".
 * Parallel steps (type="parallel") must also have an explicit `parallelGroup` id.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_ACTORS = new Set(['user', 'system', 'both']);

export async function run({ dir }) {
  const specPath = join(dir, 'task-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UTK007',
      message: 'task-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UTK007',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    return {
      pass: true,
      code: 'UTK007',
      message: 'No steps to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const step of spec.steps) {
    const stepLabel = `step(id="${step.id ?? step.order ?? 'unknown'}")`;

    // Every step must declare actor
    if (!step.actor) {
      violations.push(`${stepLabel} missing required field: actor ("user" | "system" | "both")`);
    } else if (!VALID_ACTORS.has(step.actor)) {
      violations.push(
        `${stepLabel} actor="${step.actor}" is invalid — must be "user", "system", or "both"`
      );
    }

    // Parallel steps must declare parallelGroup
    if (step.type === 'parallel') {
      if (typeof step.parallelGroup !== 'string' || step.parallelGroup.trim() === '') {
        violations.push(
          `${stepLabel} type="parallel" but missing parallelGroup id — parallel steps must be grouped`
        );
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UTK007',
      message: `${violations.length} actor/parallel violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UTK007',
    message: `step-actors: all ${spec.steps.length} step(s) have valid actor declarations`,
  };
}
