import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SMS005 — og-image-dimensions: OG image minimum dimensions must be declared (≥ 1200×630px) */
const OG_MIN_WIDTH  = 1200;
const OG_MIN_HEIGHT = 630;

export async function run({ dir }) {
  const specPath = join(dir, 'seo-metadata-spec.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'SMS005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'SMS005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.contentTypes) || spec.contentTypes.length === 0) {
    return { pass: true, code: 'SMS005', message: 'No contentTypes — gate skipped', skipped: true };
  }

  const violations = [];

  for (const ct of spec.contentTypes) {
    const og = ct.ogImage;

    if (!og) {
      violations.push(`"${ct.typeId}": ogImage not declared`);
      continue;
    }

    if (og.minWidth === undefined || og.minHeight === undefined) {
      violations.push(`"${ct.typeId}": ogImage missing minWidth or minHeight`);
      continue;
    }

    if (typeof og.minWidth !== 'number' || typeof og.minHeight !== 'number') {
      violations.push(`"${ct.typeId}": ogImage minWidth and minHeight must be numbers`);
      continue;
    }

    if (og.minWidth < OG_MIN_WIDTH) {
      violations.push(
        `"${ct.typeId}": ogImage.minWidth=${og.minWidth} is below minimum ${OG_MIN_WIDTH}px`
      );
    }

    if (og.minHeight < OG_MIN_HEIGHT) {
      violations.push(
        `"${ct.typeId}": ogImage.minHeight=${og.minHeight} is below minimum ${OG_MIN_HEIGHT}px`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'SMS005',
      message: `${violations.length} OG image dimension violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'SMS005',
    message: `All ${spec.contentTypes.length} content type(s) declare OG image ≥ ${OG_MIN_WIDTH}×${OG_MIN_HEIGHT}px`,
  };
}
