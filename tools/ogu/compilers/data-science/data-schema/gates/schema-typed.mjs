/**
 * Why:
 * Every column must declare an explicit, precise dtype. pandas infers dtype
 * on read — a column read as `object` when it should be `int64` silently
 * corrupts downstream aggregations and model features. Schema columns without
 * an explicit dtype cannot be validated, reasoned about, or trusted.
 *
 * Escape hatch: add `"object_reason": "free-text"` to any column intentionally
 * typed as `object` to acknowledge the imprecision is deliberate.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const IMPRECISE = new Set(['object', 'mixed', 'inferred', 'auto', 'any']);

export async function run({ dir }) {
  const specPath = join(dir, 'data-schema-spec.json');

  if (existsSync(specPath)) {
    let spec;
    try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
    catch { return { pass: false, code: 'DS002', message: 'data-schema-spec.json is invalid JSON' }; }

    const cols = spec.columns || [];
    const untyped   = cols.filter(c => !c.dtype);
    const imprecise = cols.filter(c => c.dtype && IMPRECISE.has(c.dtype.toLowerCase()) && !c.object_reason);

    if (untyped.length) {
      return {
        pass: false, code: 'DS002',
        message: `${untyped.length} column(s) missing dtype: ${untyped.map(c => c.name).join(', ')}`,
        detail: 'Every column must declare a precise dtype (int64, float64, string, bool, datetime64, category).\n' +
                'If "object" is intentional, add "object_reason": "explanation" to suppress this check.',
      };
    }
    if (imprecise.length) {
      return {
        pass: false, code: 'DS002',
        message: `${imprecise.length} column(s) use imprecise dtype: ${imprecise.map(c => `${c.name}(${c.dtype})`).join(', ')}`,
        detail: 'Replace "object" with a specific dtype, or add "object_reason" to acknowledge the imprecision.',
      };
    }
    return { pass: true, code: 'DS002', message: `All ${cols.length} column(s) typed explicitly` };
  }

  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!pyFiles.length) return { pass: false, code: 'DS002', message: 'No data-schema-spec.json or Python files found' };

  const content = pyFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  if (!/pa\.DataFrameSchema|pa\.Column/.test(content)) {
    return { pass: false, code: 'DS002', message: 'No pandera DataFrameSchema found — define typed column schema' };
  }
  const untyped = (content.match(/pa\.Column\s*\(\s*\)/g) || []).length;
  if (untyped) {
    return { pass: false, code: 'DS002', message: `${untyped} pa.Column() without type argument — specify dtype: pa.Column(int)` };
  }
  return { pass: true, code: 'DS002', message: 'pandera DataFrameSchema with typed columns detected' };
}
