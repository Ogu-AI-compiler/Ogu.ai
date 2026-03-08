/**
 * Gate UCS002 — unique-content-ids
 * All slot ids must be unique across the entire spec.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'copy-structure-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UCS002',
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
      code: 'UCS002',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.content_slots) || spec.content_slots.length === 0) {
    return {
      pass: true,
      code: 'UCS002',
      message: 'No content_slots to check — gate skipped',
      skipped: true,
    };
  }

  const seenIds = new Map();
  const duplicates = [];

  for (const slot of spec.content_slots) {
    if (typeof slot.id !== 'string') continue;
    if (seenIds.has(slot.id)) {
      duplicates.push(slot.id);
    } else {
      seenIds.set(slot.id, true);
    }
  }

  if (duplicates.length > 0) {
    return {
      pass: false,
      code: 'UCS002',
      message: `${duplicates.length} duplicate slot id(s) found`,
      detail: `Duplicate ids: ${[...new Set(duplicates)].join(', ')}`,
    };
  }

  return {
    pass: true,
    code: 'UCS002',
    message: `unique-content-ids: all ${spec.content_slots.length} slot id(s) are unique`,
  };
}
