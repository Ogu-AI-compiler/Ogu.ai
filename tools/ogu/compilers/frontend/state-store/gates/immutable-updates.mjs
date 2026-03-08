import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'store-spec.json'), 'utf8'));
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const violations = [];

  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf8');
    const lines = content.split('\n');

    if (spec.engine === 'zustand') {
      // Zustand: direct mutation is OK inside set() with Immer-like syntax via immer middleware,
      // but direct property assignment on state in set callback without spread is a violation
      lines.forEach((line, i) => {
        // Pattern: state.property = value (direct mutation without being in an Immer produce block)
        if (/state\.\w+\s*=(?!=)/.test(line) && !/\/\/.*immer/i.test(line) && !/produce\s*\(/.test(line)) {
          // Allow only if the file imports immer
          if (!content.includes('immer') && !content.includes('produce')) {
            violations.push(`${file}:${i + 1} — Direct state mutation without Immer: ${line.trim()}`);
          }
        }
      });
    } else if (spec.engine === 'redux-toolkit') {
      // RTK uses Immer internally, so direct assignment inside reducers is OK
      // But check for mutations OUTSIDE reducer functions
      const reducerMatch = content.match(/reducers\s*:\s*\{([\s\S]*?)\}/);
      const outsideReducers = reducerMatch ? content.replace(reducerMatch[0], '') : content;

      const outsideLines = outsideReducers.split('\n');
      outsideLines.forEach((line, i) => {
        if (/state\.\w+\s*=(?!=)/.test(line)) {
          violations.push(`${file}:${i + 1} — State mutation outside reducer (RTK Immer not active here): ${line.trim()}`);
        }
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SS005',
      message: `Mutable state updates found (${violations.length})`,
      detail: violations.slice(0, 5).join('\n')
    };
  }

  return { pass: true, code: 'SS005', message: 'State updates are immutable' };
}
