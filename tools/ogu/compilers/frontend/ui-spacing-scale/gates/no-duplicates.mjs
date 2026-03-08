import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** USS004 — no-duplicates: no two spacing steps share the same resolved pixel value */

function parsePx(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim().toLowerCase();
  const pxMatch = /^([\d.]+)px$/.exec(str);
  if (pxMatch) return parseFloat(pxMatch[1]);
  const remMatch = /^([\d.]+)rem$/.exec(str);
  if (remMatch) return parseFloat(remMatch[1]) * 16;
  const numMatch = /^[\d.]+$/.exec(str);
  if (numMatch) return parseFloat(str);
  return null;
}

export async function run({ dir }) {
  const specPath = join(dir, 'spacing-scale-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USS004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USS004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    return { pass: true, code: 'USS004', message: 'No steps — gate skipped', skipped: true };
  }

  const seen = new Map(); // px value → step id
  const duplicates = [];

  for (const step of spec.steps) {
    const stepId = step.id || step.name || '(unnamed)';
    const px = parsePx(step.value);
    if (px === null) continue; // Token reference — skip

    if (seen.has(px)) {
      duplicates.push(`Steps "${seen.get(px)}" and "${stepId}" both resolve to ${px}px`);
    } else {
      seen.set(px, stepId);
    }
  }

  if (duplicates.length > 0) {
    return {
      pass: false,
      code: 'USS004',
      message: `${duplicates.length} spacing step(s) have duplicate pixel values`,
      detail: duplicates.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'USS004', message: `No duplicate spacing values (${seen.size} unique step(s) checked)` };
}
