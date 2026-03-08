/**
 * Gate: idp-integrated (DP004)
 * Validates that an Internal Developer Portal (IDP) component is defined.
 * An IDP is the primary interface through which developers discover services,
 * documentation, golden paths, and platform capabilities. Without it,
 * platform capabilities are undiscoverable and adoption suffers.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'dev-platform-spec.json'), 'utf8'));

  if (spec.skipIDPCheck) {
    return { pass: true, code: 'DP004', message: 'skipIDPCheck=true — IDP integration check skipped', skipped: true };
  }

  const idp = spec.components.find(c => c.type?.toLowerCase() === 'idp');

  if (!idp) {
    return {
      pass: false, code: 'DP004',
      message: 'No IDP (Internal Developer Portal) component defined',
      detail: {
        hint:    'Add an idp component with a tool field (e.g., backstage, cortex, port). Set skipIDPCheck: true for exemption.',
        example: '{ type: "idp", tool: "backstage", url: "https://backstage.example.com" }',
      },
    };
  }

  if (!idp.tool) {
    return {
      pass: false, code: 'DP004',
      message: 'IDP component is missing a tool field',
      detail: { hint: 'Specify the IDP tool being used (e.g., "backstage", "cortex", "port")' },
    };
  }

  return { pass: true, code: 'DP004', message: `IDP integrated: ${idp.tool}` };
}
