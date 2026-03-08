import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'story-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'SB001', message: 'story-spec.json not found' };
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'SB001', message: `Invalid JSON: ${e.message}` }; }
  const required = ['component', 'stories'];
  const missing = required.filter(f => !spec[f]);
  if (missing.length) return { pass: false, code: 'SB001', message: `Missing: ${missing.join(', ')}` };
  if (!Array.isArray(spec.stories) || !spec.stories.length) return { pass: false, code: 'SB001', message: 'stories must be non-empty array of story names (e.g. ["Default", "Loading", "Error"])' };
  return { pass: true, code: 'SB001', message: `Spec valid — ${spec.component}, ${spec.stories.length} stories: [${spec.stories.join(', ')}]` };
}
