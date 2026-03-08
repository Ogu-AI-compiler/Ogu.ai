import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const NETWORK_PATTERNS = ['fetch(', 'axios.', 'http.get', 'http.post', 'XMLHttpRequest', 'supertest(', 'request('];
const MOCK_PATTERNS = ['jest.fn()', 'vi.fn()', 'mockResolvedValue', 'mockReturnValue', 'msw', 'setupServer', 'rest.get', 'http.get('];

export async function run({ dir }) {
  const testFiles = readdirSync(dir).filter(f => f.endsWith('.test.tsx') || f.endsWith('.test.ts') || f.endsWith('.spec.tsx') || f.endsWith('.spec.ts'));
  if (!testFiles.length) return { pass: false, code: 'UT003', message: 'No test file found' };
  const content = testFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const rawNetwork = NETWORK_PATTERNS.filter(p => content.includes(p));
  const hasMock = MOCK_PATTERNS.some(p => content.includes(p));

  if (rawNetwork.length && !hasMock) {
    return {
      pass: false, code: 'UT003',
      message: `Real network calls detected: ${rawNetwork.join(', ')}`,
      detail: 'Unit tests must not make real network calls — use vi.fn() / msw / mockResolvedValue'
    };
  }

  return { pass: true, code: 'UT003', message: 'No real network calls in unit tests' };
}
