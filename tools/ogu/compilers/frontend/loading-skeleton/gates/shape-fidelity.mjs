import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SHAPE_PATTERNS = {
  list: { required: ['li|ul|div.*gap|space-y', 'skeleton.*row|row.*skeleton'], count: 1 },
  card: { required: ['rounded|card', 'h-\\d|w-\\d'], count: 1 },
  table: { required: ['tr|tbody|table|grid-cols', 'th|td|col'], count: 1 },
  form: { required: ['input|label|field', 'button|submit'], count: 1 },
  profile: { required: ['rounded-full|avatar|circle', 'h-\\d|w-\\d'], count: 1 },
  article: { required: ['h-\\d.*w-\\d|space-y', 'mb-|mt-|p-'], count: 1 },
  grid: { required: ['grid|grid-cols', 'gap-'], count: 1 },
  custom: { required: [], count: 0 }
};

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'skeleton-spec.json'), 'utf8'));
  const { shape, rows = 3 } = spec;

  if (shape === 'custom') {
    return { pass: true, code: 'SK006', message: 'Custom shape — skipping structural fidelity check', skipped: true };
  }

  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx'));
  if (!files.length) {
    return { pass: false, code: 'SK006', message: 'No skeleton component file found' };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const pattern = SHAPE_PATTERNS[shape] || SHAPE_PATTERNS.custom;

  const missing = pattern.required.filter(p => !new RegExp(p, 'i').test(content));

  if (missing.length) {
    return {
      pass: false, code: 'SK006',
      message: `Skeleton shape '${shape}' missing structural elements`,
      detail: `Expected patterns for '${shape}': ${missing.join(', ')}`
    };
  }

  // Check row count for list/table/grid
  if (['list', 'table', 'grid'].includes(shape) && rows > 1) {
    // Simple heuristic: look for Array.from or repeat
    const hasRepeat = /Array\.from|\.map|repeat|times/.test(content) ||
                      content.split('\n').filter(l => /skeleton|animate-pulse|bg-muted/.test(l)).length >= rows;

    if (!hasRepeat) {
      return {
        pass: false, code: 'SK006',
        message: `${shape} skeleton expects ${rows} rows but no repeat pattern found`,
        detail: 'Use Array.from({ length: rows }, (_, i) => <SkeletonRow key={i} />)'
      };
    }
  }

  return { pass: true, code: 'SK006', message: `Shape fidelity valid — ${shape} pattern matches spec` };
}
