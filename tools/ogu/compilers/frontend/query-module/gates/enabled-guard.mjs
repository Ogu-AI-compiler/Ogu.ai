import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'query-spec.json'), 'utf8'));
  const requiredParams = [
    ...(spec.pathParams || []),
    ...(spec.queryParams || []).filter(p => p.required !== false)
  ];

  // If no required params, guard is not needed
  if (!requiredParams.length) {
    return { pass: true, code: 'QM006', message: 'No required params — enabled guard not needed', skipped: true };
  }

  const hookFiles = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && f.startsWith('use'));
  if (!hookFiles.length) {
    return { pass: false, code: 'QM006', message: 'No hook file found' };
  }

  const content = readFileSync(join(dir, hookFiles[0]), 'utf8');

  // Check for enabled: false guard or enabled: !!param pattern
  const hasEnabledGuard = /enabled\s*:\s*(false|!!|Boolean|!!.*\?\.|typeof.*!==\s*['"]undefined['"])/.test(content) ||
                           /enabled\s*:\s*\w+\s*!==\s*undefined/.test(content) ||
                           /enabled\s*:\s*\w+\s*!=\s*null/.test(content);

  if (!hasEnabledGuard) {
    return {
      pass: false, code: 'QM006',
      message: `Required params [${requiredParams.join(', ')}] present but no enabled guard found`,
      detail: 'Add enabled: !!paramName or enabled: paramName !== undefined to prevent spurious requests'
    };
  }

  return { pass: true, code: 'QM006', message: 'enabled guard present for required params' };
}
