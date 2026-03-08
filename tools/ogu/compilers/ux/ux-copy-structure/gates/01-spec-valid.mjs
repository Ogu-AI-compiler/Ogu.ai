/**
 * Gate UCS001 — spec-valid
 * copy-structure-spec.json must exist with:
 * - content_slots (array) — each slot has:
 *   - id (string)
 *   - screen (string)
 *   - priority (string: "primary" | "secondary" | "tertiary")
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_PRIORITIES = new Set(['primary', 'secondary', 'tertiary']);

export async function run({ dir }) {
  const specPath = join(dir, 'copy-structure-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UCS001',
      message: 'copy-structure-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'UCS001',
      message: `copy-structure-spec.json parse error: ${err.message}`,
    };
  }

  if (!Array.isArray(spec.content_slots)) {
    return {
      pass: false,
      code: 'UCS001',
      message: 'copy-structure-spec.json missing required field: content_slots (array)',
    };
  }

  if (spec.content_slots.length === 0) {
    return {
      pass: false,
      code: 'UCS001',
      message: 'content_slots array is empty — at least one content slot is required',
    };
  }

  const violations = [];

  spec.content_slots.forEach((slot, i) => {
    if (typeof slot.id !== 'string' || slot.id.trim() === '') {
      violations.push(`content_slots[${i}] missing or empty field: id (string)`);
    }
    if (typeof slot.screen !== 'string' || slot.screen.trim() === '') {
      violations.push(
        `content_slots[${i}](id="${slot.id ?? 'unknown'}") missing or empty field: screen (string)`
      );
    }
    if (typeof slot.priority !== 'string' || !VALID_PRIORITIES.has(slot.priority)) {
      violations.push(
        `content_slots[${i}](id="${slot.id ?? 'unknown'}") priority="${slot.priority}" is invalid — ` +
        'must be "primary", "secondary", or "tertiary"'
      );
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCS001',
      message: `${violations.length} slot(s) with structural violations`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UCS001',
    message: `spec-valid: ${spec.content_slots.length} content slot(s) found`,
  };
}
