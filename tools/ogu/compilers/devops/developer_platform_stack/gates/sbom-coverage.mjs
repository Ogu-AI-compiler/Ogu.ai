/**
 * Gate: sbom-coverage (DP005)
 * Validates that an SBOM (Software Bill of Materials) component is present
 * in the platform stack. SBOMs are required for supply chain integrity
 * verification, compliance (e.g., EO 14028), and vulnerability tracking
 * when a new CVE is discovered.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'dev-platform-spec.json'), 'utf8'));

  if (spec.skipSBOM) {
    return { pass: true, code: 'DP005', message: 'skipSBOM=true — SBOM coverage check skipped', skipped: true };
  }

  const hasSBOM = spec.components.some(c => c.type?.toLowerCase() === 'sbom');

  if (!hasSBOM) {
    return {
      pass: false, code: 'DP005',
      message: 'No SBOM component defined — supply chain integrity requires SBOM generation',
      detail: {
        hint:    'Add an sbom component to the platform stack. Set skipSBOM: true with justification for exemption.',
        example: '{ type: "sbom", tool: "syft", format: "cyclonedx" }',
      },
    };
  }

  return { pass: true, code: 'DP005', message: 'SBOM component present' };
}
