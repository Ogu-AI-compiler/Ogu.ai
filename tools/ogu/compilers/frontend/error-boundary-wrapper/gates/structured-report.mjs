import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'EB006', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const hasComponentDidCatch = /componentDidCatch/.test(content);
  const hasOnError = /onError\s*=/.test(content); // react-error-boundary pattern
  if (!hasComponentDidCatch && !hasOnError) {
    return { pass: true, code: 'EB006', message: 'No error reporting hook (optional for simple boundaries)' };
  }

  // If reporting exists, must not be just console.log
  const hasOnlyConsoleLog = /componentDidCatch[^}]*console\.log[^}]*}/.test(content) && !/Sentry|captureException|reportError|logger\.|errorService/.test(content);
  if (hasOnlyConsoleLog) {
    return {
      pass: false, code: 'EB006',
      message: 'Error reporting uses only console.log — use a structured sink (Sentry, logger, errorService)',
      detail: 'componentDidCatch should call captureException(error) or errorService.report({ error, info })'
    };
  }

  return { pass: true, code: 'EB006', message: 'Error reporting is structured' };
}
