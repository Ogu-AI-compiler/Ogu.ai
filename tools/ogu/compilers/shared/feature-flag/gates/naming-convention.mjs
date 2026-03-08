import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Flag names must be kebab-case: enable-new-dashboard, show-beta-feature
const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export async function run({ dir }) {
  const specPath = join(dir, 'flag-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'FF005', message: 'flag-spec.json not found' };

  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const violations = (spec.flags || []).filter(f => f.name && !KEBAB_CASE.test(f.name));

  if (violations.length) {
    return {
      pass: false, code: 'FF005',
      message: `${violations.length} flag name(s) not kebab-case`,
      detail: violations.map(f => `  "${f.name}" → e.g. "${f.name.toLowerCase().replace(/[_\s]+/g, '-')}"`).join('\n')
    };
  }

  return { pass: true, code: 'FF005', message: `All ${spec.flags.length} flag names are kebab-case` };
}
