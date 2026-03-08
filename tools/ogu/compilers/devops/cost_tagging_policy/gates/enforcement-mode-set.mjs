/**
 * Gate: enforcement-mode-set (CT005)
 * Validates that an explicit enforcement mode is declared. Without a mode,
 * the tagging policy intent is ambiguous — it is unclear whether missing tags
 * should block resource creation (enforce), generate warnings (warn), or only
 * be logged for review (audit).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_MODES = new Set(['audit', 'enforce', 'warn']);

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'cost-tagging-spec.json'), 'utf8'));

  if (!spec.enforcementMode) {
    return {
      pass: false, code: 'CT005',
      message: 'enforcementMode not set',
      detail: {
        allowed: [...VALID_MODES],
        guidance: {
          audit:   'Log missing tags but allow resource creation — use during rollout',
          warn:    'Alert on missing tags without blocking — use for soft enforcement',
          enforce: 'Block resource creation if required tags are missing — use for full compliance',
        },
        hint: 'Set enforcementMode to match the desired compliance posture',
      },
    };
  }

  if (!VALID_MODES.has(spec.enforcementMode)) {
    return {
      pass: false, code: 'CT005',
      message: `enforcementMode "${spec.enforcementMode}" is not a valid mode`,
      detail: { received: spec.enforcementMode, allowed: [...VALID_MODES] },
    };
  }

  return { pass: true, code: 'CT005', message: `Enforcement mode: ${spec.enforcementMode}` };
}
