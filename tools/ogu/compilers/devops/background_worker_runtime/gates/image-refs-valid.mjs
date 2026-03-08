/**
 * Gate: image-refs-valid (BW002)
 * Validates that the worker image is pinned to a specific version tag or digest.
 * A floating :latest tag means different worker versions will be running after
 * a node restart — message schema mismatches become impossible to diagnose.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const MUTABLE_TAGS = new Set(['dev', 'main', 'master', 'edge', 'stable', 'nightly']);

export async function run({ dir }) {
  const spec  = JSON.parse(readFileSync(join(dir, 'bg-worker-spec.json'), 'utf8'));
  const image = spec.image || '';

  if (!image) {
    return {
      pass: false, code: 'BW002',
      message: 'No image specified',
      detail: { hint: 'Add image: "my-worker:1.2.3" to the spec' },
    };
  }

  if (image.endsWith(':latest')) {
    return {
      pass: false, code: 'BW002',
      message: `Worker image uses ":latest" tag — not deterministic`,
      detail: { image, hint: 'Pin to a specific version: my-worker:1.2.3 or my-worker@sha256:abc123' },
    };
  }

  if (!image.includes(':') && !image.includes('@')) {
    return {
      pass: false, code: 'BW002',
      message: `Worker image has no tag or digest — implicitly uses :latest`,
      detail: { image, hint: 'Add a version tag: my-worker:1.2.3' },
    };
  }

  const tag = image.includes(':') ? image.split(':').pop() : null;
  if (tag && MUTABLE_TAGS.has(tag)) {
    return {
      pass: false, code: 'BW002',
      message: `Worker image uses mutable tag ":${tag}"`,
      detail: { image, tag, hint: 'Use an immutable version tag — not a branch name or environment label' },
    };
  }

  return { pass: true, code: 'BW002', message: `Worker image pinned: ${image}` };
}
