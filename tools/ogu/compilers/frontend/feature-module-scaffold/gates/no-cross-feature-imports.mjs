import { readFileSync, readdirSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
  const violations = [];
  const featureName = dir.split('/').pop();
  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      // Direct import from sibling feature directory (../other-feature/...)
      const m = line.match(/from\s+['"]\.\.\/([^/'"]+)\//);
      if (m && m[1] !== featureName && !line.includes('shared') && !line.includes('lib') && !line.includes('utils')) {
        violations.push(`${file}:${i+1} — cross-feature import: ${m[1]}`);
      }
    });
  }
  if (violations.length) return { pass: false, code: 'FM004', message: `Cross-feature imports found: ${violations.length}`, detail: violations.slice(0, 5).join('\n') + '\nFeatures must communicate via shared contracts, not direct imports' };
  return { pass: true, code: 'FM004', message: 'No cross-feature imports' };
}
