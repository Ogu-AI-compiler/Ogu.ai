/**
 * Gate: image-refs-valid (KW004)
 * Validates that all container image references are pinned to a specific version tag
 * or digest. Floating tags (:latest, :dev, :main) are non-deterministic — the same
 * workload spec will pull different images on different nodes or deployments.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const MUTABLE_TAGS = new Set(['dev', 'main', 'master', 'edge', 'stable', 'nightly', 'canary']);

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'k8s-workload-spec.json'), 'utf8'));
  const containers = spec.containers || [{ name: spec.name, image: spec.image }];
  const violations = [];

  for (const container of containers) {
    const image = container.image;
    if (!image) {
      violations.push({ container: container.name, reason: 'no image declared' });
      continue;
    }

    if (image.endsWith(':latest')) {
      violations.push({ container: container.name, image, reason: 'uses ":latest" tag — not deterministic' });
    } else if (!image.includes(':') && !image.includes('@sha256:')) {
      violations.push({ container: container.name, image, reason: 'no version tag or digest — implicitly uses :latest' });
    } else if (image.includes(':')) {
      const tag = image.split(':').pop();
      if (MUTABLE_TAGS.has(tag)) {
        violations.push({ container: container.name, image, reason: `uses mutable tag ":${tag}" — not safe for production` });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'KW004',
      message: `${violations.length} image reference issue(s)`,
      detail: {
        violations,
        hint: 'Pin all images to a specific version (e.g. my-app:1.2.3) or digest (my-app@sha256:abc123)',
      },
    };
  }

  return {
    pass: true, code: 'KW004',
    message: `All ${containers.length} image reference(s) are pinned to specific versions`,
  };
}
