import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'store-spec.json'), 'utf8'));

  // Zustand allows async in actions (not pure reducers), so this is Redux-specific
  if (spec.engine === 'zustand') {
    return { pass: true, code: 'SS006', message: 'Zustand allows async actions — skipping reducer check', skipped: true };
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const violations = [];

  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf8');

    // Find reducers block in createSlice
    const reducersMatch = content.match(/reducers\s*:\s*\{([\s\S]*?)\},?\s*(?:extraReducers|}\s*\))/);
    if (!reducersMatch) continue;

    const reducersBody = reducersMatch[1];

    // Check for async keyword inside sync reducers
    const asyncInReducers = reducersBody.match(/\basync\b/g);
    if (asyncInReducers) {
      violations.push(`${file} — async inside sync reducers. Use createAsyncThunk + extraReducers for async logic`);
    }

    // Check for promise/await inside reducers
    if (/\bawait\b/.test(reducersBody) || /\.then\s*\(/.test(reducersBody)) {
      violations.push(`${file} — Promise/await in sync reducer. Move to createAsyncThunk`);
    }

    // Check for fetch/axios inside reducers
    if (/\bfetch\s*\(|\baxios\./.test(reducersBody)) {
      violations.push(`${file} — Network call inside sync reducer. Move to createAsyncThunk or RTK Query`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SS006',
      message: `Async logic in sync reducers (${violations.length})`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'SS006', message: 'No async logic in sync reducers' };
}
