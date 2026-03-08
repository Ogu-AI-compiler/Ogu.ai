/**
 * Gate: kustomization-valid (KO002)
 * Validates that kustomization.yaml exists and declares at least one of the
 * resource list fields (resources, bases, or components). A kustomization
 * file with no resource declarations builds nothing and will produce an empty
 * or invalid manifest output.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const RESOURCE_FIELDS = ['resources', 'bases', 'components'];

export async function run({ dir }) {
  const kustPath = join(dir, 'kustomization.yaml');

  if (!existsSync(kustPath)) {
    return {
      pass: false, code: 'KO002',
      message: 'kustomization.yaml not found',
      detail: { searched: kustPath, hint: 'Every kustomize overlay must have a kustomization.yaml file' },
    };
  }

  const content = readFileSync(kustPath, 'utf8');
  const hasResources = RESOURCE_FIELDS.some(field => content.includes(`${field}:`));

  if (!hasResources) {
    return {
      pass: false, code: 'KO002',
      message: `kustomization.yaml missing resources/bases/components field`,
      detail: {
        required: 'At least one of: resources, bases, components',
        hint: 'Add a resources: section listing the base manifests or directories this overlay applies to',
      },
    };
  }

  return { pass: true, code: 'KO002', message: 'kustomization.yaml valid' };
}
