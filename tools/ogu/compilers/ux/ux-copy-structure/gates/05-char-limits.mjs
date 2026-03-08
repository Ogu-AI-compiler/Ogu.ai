/**
 * Gate UCS005 — char-limits
 * Every slot with priority="primary" must declare `charLimit` (number > 0).
 * CTA buttons and primary labels without a character budget create layout overflow risk.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'copy-structure-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UCS005',
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
      code: 'UCS005',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.content_slots) || spec.content_slots.length === 0) {
    return {
      pass: true,
      code: 'UCS005',
      message: 'No content_slots to check — gate skipped',
      skipped: true,
    };
  }

  // Only primary slots must have charLimit
  const primarySlots = spec.content_slots.filter(s => s.priority === 'primary');

  if (primarySlots.length === 0) {
    return {
      pass: true,
      code: 'UCS005',
      message: 'char-limits: no primary slots found — gate not applicable',
      skipped: true,
    };
  }

  const violations = [];

  for (const slot of primarySlots) {
    const slotLabel = `slot(id="${slot.id ?? 'unknown'}", priority="primary")`;

    const hasCharLimit =
      typeof slot.charLimit === 'number' &&
      Number.isFinite(slot.charLimit) &&
      slot.charLimit > 0;

    if (!hasCharLimit) {
      violations.push(
        `${slotLabel} missing charLimit (positive number) — ` +
        'primary content slots need a character budget to prevent layout overflow'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCS005',
      message: `${violations.length} primary slot(s) missing charLimit`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UCS005',
    message: `char-limits: all ${primarySlots.length} primary slot(s) declare charLimit`,
  };
}
