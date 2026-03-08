import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const violations = [];

  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf8');
    const lines = content.split('\n');

    // Find exported selectors (export const selectXxx = ...)
    const selectorIndices = [];
    lines.forEach((line, i) => {
      if (/export\s+const\s+select\w+\s*=/.test(line)) {
        selectorIndices.push(i);
      }
    });

    for (const idx of selectorIndices) {
      // Look at the next ~10 lines for violations
      const selectorBody = lines.slice(idx, idx + 15).join('\n');

      if (/Math\.random\(\)|Date\.now\(\)|new Date\(\)/.test(selectorBody)) {
        violations.push(`${file}:${idx + 1} — Selector uses non-deterministic value (Math.random/Date.now)`);
      }

      if (/localStorage\.|sessionStorage\./.test(selectorBody)) {
        violations.push(`${file}:${idx + 1} — Selector reads from storage — not pure`);
      }

      if (/fetch\s*\(|axios\./.test(selectorBody)) {
        violations.push(`${file}:${idx + 1} — Selector makes network call — not pure`);
      }

      // Selectors that create new arrays/objects directly (non-memoized) cause re-renders
      if (/=>\s*\[/.test(selectorBody) || /=>\s*\{/.test(selectorBody)) {
        if (!/createSelector|useMemo/.test(content)) {
          violations.push(`${file}:${idx + 1} — Selector returns new array/object literal — wrap with createSelector for memoization`);
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SS007',
      message: `Impure selectors found (${violations.length})`,
      detail: violations.slice(0, 5).join('\n')
    };
  }

  return { pass: true, code: 'SS007', message: 'Selectors are pure' };
}
