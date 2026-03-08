import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'animation-spec.json'), 'utf8'));
  const tokensRef = spec.tokensArtifact;

  if (!tokensRef) {
    return { pass: true, code: 'AN010', message: 'No tokensArtifact referenced — skipping cross-tokens check', skipped: true };
  }

  const artifactPath = resolve(dir, tokensRef);
  if (!existsSync(artifactPath)) {
    return { pass: false, code: 'AN010', message: `tokens-artifact not found: ${artifactPath} — compile design-tokens first` };
  }

  const tokensArtifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  const violations = [];

  // Check any duration tokens referenced by name exist in tokens
  for (const [name, variant] of Object.entries(spec.variants)) {
    if (typeof variant.transition?.duration === 'string') {
      // String duration = token reference (e.g. "animation.duration.fast")
      const tokenRef = variant.transition.duration;
      if (!tokensArtifact.token_categories?.includes('animation')) {
        violations.push(`Variant '${name}' references animation token '${tokenRef}' but tokens-artifact has no animation category`);
      }
    }
  }

  if (violations.length) {
    return { pass: false, code: 'AN010', message: 'Animation token references not in tokens-artifact', detail: violations.join('\n') };
  }

  return { pass: true, code: 'AN010', message: 'Animation token references valid' };
}
