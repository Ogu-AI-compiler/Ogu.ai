import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'flag-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'FF004', message: 'flag-spec.json not found' };

  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const violations = [];

  for (const flag of (spec.flags || [])) {
    // killswitch/disable flags: safe default is false (feature off)
    if (flag.type === 'killswitch' && flag.defaultValue !== false) {
      violations.push(`[${flag.name}] killswitch flag must default to false`);
      continue;
    }
    // All flags must have an explicit defaultValue (not undefined/null)
    if (flag.defaultValue === undefined || flag.defaultValue === null) {
      violations.push(`[${flag.name}] missing defaultValue — flags must have safe fallback for service outages`);
    }
    // Boolean flags: warn if defaultValue is true (most flags should default off)
    if (typeof flag.defaultValue === 'boolean' && flag.defaultValue === true && !flag.safeToDefaultOn) {
      violations.push(`[${flag.name}] defaultValue:true — add safeToDefaultOn:true if intentional (flags should default off)`);
    }
  }

  if (violations.length) {
    return { pass: false, code: 'FF004', message: `${violations.length} safe-default violation(s)`, detail: violations.join('\n') };
  }

  return { pass: true, code: 'FF004', message: `All ${spec.flags.length} flags have safe defaults` };
}
