/**
 * Gate URT002 — layouts-flipped
 * Every element with type="layout" and currentDirection="ltr" must declare either:
 * - rtlMirror: true, OR
 * - rtlOverride (object with explicit RTL rules)
 * Horizontal layouts that don't account for RTL create mirroring bugs.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'rtl-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URT002',
      message: 'rtl-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'URT002',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.elements)) {
    return {
      pass: true,
      code: 'URT002',
      message: 'No elements array — skipped',
      skipped: true,
    };
  }

  const layoutLtrElements = spec.elements.filter(
    el => el.type === 'layout' && el.currentDirection === 'ltr'
  );

  if (layoutLtrElements.length === 0) {
    return {
      pass: true,
      code: 'URT002',
      message: 'layouts-flipped: no LTR layout elements — gate not applicable',
    };
  }

  const violations = [];
  layoutLtrElements.forEach(el => {
    const id = el.id || 'unknown';
    const hasMirror = el.rtlMirror === true;
    const hasOverride = typeof el.rtlOverride === 'object' && el.rtlOverride !== null && !Array.isArray(el.rtlOverride);
    if (!hasMirror && !hasOverride) {
      violations.push(
        `Element "${id}" (type=layout, currentDirection=ltr) missing rtlMirror:true or rtlOverride object`
      );
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URT002',
      message: `${violations.length} LTR layout element(s) missing RTL mirroring declaration`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URT002',
    message: `layouts-flipped: all ${layoutLtrElements.length} LTR layout element(s) have RTL mirror or override`,
  };
}
