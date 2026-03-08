import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'store-spec.json'), 'utf8'));
  const { name, engine } = spec;

  // Zustand: file should be use{Name}Store.ts or {name}Store.ts
  // Redux: file should be {name}Slice.ts
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  if (engine === 'zustand') {
    const storeFile = files.find(f => f.includes('Store') || f.includes('store'));
    if (!storeFile) {
      return { pass: false, code: 'SS002', message: 'No store file found. Expected: use{Name}Store.ts or {name}Store.ts' };
    }

    // Zustand hooks should use the store pattern
    const content = readFileSync(join(dir, storeFile), 'utf8');
    if (!/create\s*[(<]/.test(content) && !/createStore/.test(content)) {
      return { pass: false, code: 'SS002', message: 'Store file does not use Zustand create()' };
    }
  } else if (engine === 'redux-toolkit') {
    const sliceFile = files.find(f => f.includes('Slice') || f.includes('slice'));
    if (!sliceFile) {
      return { pass: false, code: 'SS002', message: 'No slice file found. Expected: {name}Slice.ts' };
    }

    const content = readFileSync(join(dir, sliceFile), 'utf8');
    if (!/createSlice/.test(content)) {
      return { pass: false, code: 'SS002', message: 'Redux slice must use createSlice from @reduxjs/toolkit' };
    }
  }

  return { pass: true, code: 'SS002', message: `Store naming valid — ${engine} pattern found` };
}
