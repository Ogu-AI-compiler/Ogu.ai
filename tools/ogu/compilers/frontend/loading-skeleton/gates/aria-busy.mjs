import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));

  if (!files.length) {
    return { pass: false, code: 'SK004', message: 'No component file found' };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const hasAriaBusy = /aria-busy\s*=\s*[{"']true/.test(content) || /aria-busy/.test(content);
  const hasRole = /role\s*=\s*["']status["']|role\s*=\s*["']alert["']/.test(content);
  const hasAriaLabel = /aria-label\s*=/.test(content);

  if (!hasAriaBusy) {
    return {
      pass: false, code: 'SK004',
      message: 'Missing aria-busy="true" on skeleton container',
      detail: 'Add: <div aria-busy="true" aria-label="Loading..." role="status">...'
    };
  }

  return {
    pass: true, code: 'SK004',
    message: `aria-busy present${hasRole ? ', role=status' : ''}${hasAriaLabel ? ', aria-label' : ''}`
  };
}
