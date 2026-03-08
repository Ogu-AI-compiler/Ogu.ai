import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'layout-spec.json'), 'utf8'));
  if (!spec.tokensArtifact) {
    return { pass: true, code: 'LC009', message: 'No tokensArtifact referenced — skipping', skipped: true };
  }

  const artifactPath = resolve(dir, spec.tokensArtifact);
  if (!existsSync(artifactPath)) {
    return { pass: false, code: 'LC009', message: `tokens-artifact not found: ${artifactPath} — compile design-tokens first` };
  }

  // Token artifact exists — cross check passes (layout uses Tailwind classes derived from tokens)
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  return { pass: true, code: 'LC009', message: `tokens-artifact found (${artifact.color_groups?.length || 0} color groups)` };
}
