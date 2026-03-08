import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Implementation-detail queries to avoid (Testing Library priority: role > label > text > testid)
const BAD_QUERIES = ['getByTestId', 'queryByTestId', 'getAllByTestId', 'findByTestId', 'getByClassName', 'querySelector', 'getElementsBy'];
const GOOD_QUERIES = ['getByRole', 'getByLabelText', 'getByPlaceholderText', 'getByText', 'getByDisplayValue', 'getByAltText', 'getByTitle'];

export async function run({ dir }) {
  const testFiles = readdirSync(dir).filter(f => f.endsWith('.test.tsx') || f.endsWith('.test.ts') || f.endsWith('.spec.tsx') || f.endsWith('.spec.ts'));
  if (!testFiles.length) return { pass: false, code: 'UT002', message: 'No test file found' };
  const content = testFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const badUsed = BAD_QUERIES.filter(q => content.includes(q));
  const goodUsed = GOOD_QUERIES.filter(q => content.includes(q));

  if (badUsed.length && !goodUsed.length) {
    return {
      pass: false, code: 'UT002',
      message: `Implementation-detail queries used: ${badUsed.join(', ')}`,
      detail: 'Prefer: getByRole, getByLabelText, getByText — they test what users see, not implementation details'
    };
  }

  if (badUsed.length) {
    return {
      pass: false, code: 'UT002',
      message: `${badUsed.length} impl-detail query/queries found: ${badUsed.join(', ')}`,
      detail: `Replace with: ${GOOD_QUERIES.slice(0, 3).join(', ')}`
    };
  }

  return { pass: true, code: 'UT002', message: `User-centric queries used: ${goodUsed.slice(0, 3).join(', ')}` };
}
