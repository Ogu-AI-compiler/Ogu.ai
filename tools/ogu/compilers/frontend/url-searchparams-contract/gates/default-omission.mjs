import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'searchparams-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'USP006', message: 'searchparams-spec.json not found' };
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));

  const defaultParams = (spec.params || []).filter(p => p.default !== undefined);
  if (!defaultParams.length) return { pass: true, code: 'USP006', message: 'No default values declared — omission not required' };

  const files = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'USP006', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // serialize() should skip params equal to default
  const hasOmissionLogic = /=== default|=== spec\.|omit|delete|undefined.*default|default.*undefined/.test(content);
  if (!hasOmissionLogic) {
    return {
      pass: false, code: 'USP006',
      message: `${defaultParams.length} param(s) have defaults but serialize() has no omission logic`,
      detail: 'Params equal to their default value must be omitted from the URL to keep URLs clean'
    };
  }

  return { pass: true, code: 'USP006', message: 'Default values are omitted from serialized URL' };
}
