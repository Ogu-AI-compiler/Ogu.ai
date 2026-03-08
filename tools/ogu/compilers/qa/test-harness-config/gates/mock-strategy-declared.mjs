import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA007 — mock-strategy-declared
 * mockStrategy must be one of the recognised values.
 * An undeclared mock strategy means every developer chooses differently,
 * leading to mixed mocking patterns that interact badly (vi.mock + MSW collisions,
 * module cache not reset between tests, etc.)
 *
 * Valid strategies:
 * - msw         — Mock Service Worker (best for HTTP mocking)
 * - jest.mock   — factory-level module mocking
 * - vi.spyOn    — function-level spying (Vitest)
 * - manual      — hand-rolled mocks in __mocks__ directories
 * - nock        — HTTP interceptor for Node.js tests
 * - sinon       — standalone spy/stub/fake library
 */

const VALID_STRATEGIES = new Set(['msw', 'jest.mock', 'vi.spyOn', 'manual', 'nock', 'sinon']);

export async function run({ dir }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'test-harness-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA007', message: 'test-harness-spec.json not readable' };
  }

  const strategy = spec.mockStrategy;
  if (!strategy) {
    return {
      pass: false, code: 'QA007',
      message: 'mockStrategy not declared in spec',
      detail: `Set mockStrategy to one of: ${[...VALID_STRATEGIES].join(', ')}\nThis ensures consistent HTTP mocking across the codebase.`,
    };
  }

  // Allow comma-separated multi-strategy (e.g. "msw,vi.spyOn")
  const declared = String(strategy).split(',').map(s => s.trim());
  const invalid = declared.filter(s => !VALID_STRATEGIES.has(s));

  if (invalid.length > 0) {
    return {
      pass: false, code: 'QA007',
      message: `mockStrategy contains unrecognised value(s): ${invalid.join(', ')}`,
      detail: `Valid strategies: ${[...VALID_STRATEGIES].join(', ')}`,
    };
  }

  return {
    pass: true, code: 'QA007',
    message: `mockStrategy declared: ${declared.join(', ')}`,
  };
}
