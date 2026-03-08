import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'config-spec.json'), 'utf8'));

  const violations = [];

  for (const key of spec.envKeys) {
    const isRequired = key.required === true;
    const hasDefault = 'default' in key && key.default !== undefined;

    if (!isRequired && !hasDefault) {
      violations.push(`"${key.name}" is not required and has no default — every key must be required:true OR have a default`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'CV003',
      message: `${violations.length} key(s) have neither required:true nor a default value`,
      detail: violations.join('\n')
    };
  }

  return {
    pass: true, code: 'CV003',
    message: `Schema complete — all ${spec.envKeys.length} keys are required or have defaults`
  };
}
