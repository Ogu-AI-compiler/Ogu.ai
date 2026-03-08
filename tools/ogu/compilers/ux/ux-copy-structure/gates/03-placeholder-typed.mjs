/**
 * Gate UCS003 — placeholder-typed
 * Every `placeholder` in any slot must be an object with:
 * - key (string)
 * - type (string: "string" | "number" | "date" | "currency" | "count")
 * - example (string)
 * Bare string placeholders without type are violations.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_PLACEHOLDER_TYPES = new Set(['string', 'number', 'date', 'currency', 'count']);

export async function run({ dir }) {
  const specPath = join(dir, 'copy-structure-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UCS003',
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
      code: 'UCS003',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.content_slots) || spec.content_slots.length === 0) {
    return {
      pass: true,
      code: 'UCS003',
      message: 'No content_slots to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const slot of spec.content_slots) {
    // Skip slots with no placeholders
    if (!Array.isArray(slot.placeholders) || slot.placeholders.length === 0) continue;

    const slotLabel = `slot(id="${slot.id ?? 'unknown'}")`;

    slot.placeholders.forEach((ph, i) => {
      const phLabel = `${slotLabel}.placeholders[${i}]`;

      // Bare string placeholder (not an object) is a violation
      if (typeof ph === 'string') {
        violations.push(
          `${phLabel} is a bare string "${ph}" — must be an object with key, type, and example`
        );
        return;
      }

      if (typeof ph !== 'object' || ph === null) {
        violations.push(`${phLabel} is not a valid placeholder object`);
        return;
      }

      // key must be a non-empty string
      if (typeof ph.key !== 'string' || ph.key.trim() === '') {
        violations.push(`${phLabel} missing or empty field: key (string)`);
      }

      // type must be a valid enum value
      if (typeof ph.type !== 'string' || !VALID_PLACEHOLDER_TYPES.has(ph.type)) {
        violations.push(
          `${phLabel}(key="${ph.key ?? 'unknown'}") type="${ph.type}" is invalid — ` +
          `must be one of: ${[...VALID_PLACEHOLDER_TYPES].join(', ')}`
        );
      }

      // example must be a non-empty string
      if (typeof ph.example !== 'string' || ph.example.trim() === '') {
        violations.push(
          `${phLabel}(key="${ph.key ?? 'unknown'}") missing or empty field: example (string)`
        );
      }
    });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCS003',
      message: `${violations.length} placeholder violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UCS003',
    message: 'placeholder-typed: all placeholders have key, type, and example',
  };
}
