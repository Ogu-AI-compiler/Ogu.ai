import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';

/**
 * GS002 — schema-parses
 * The SDL file must parse without errors.
 * Uses graphql-js parse via npx or falls back to basic structural checks.
 */

export async function run({ dir, projectRoot }) {
  const spec = JSON.parse(readFileSync(join(dir, 'graphql-schema-spec.json'), 'utf8'));
  const sdlPath = join(dir, spec.sdlFile);
  if (!existsSync(sdlPath)) return { pass: false, code: 'GS002', message: `SDL file not found: ${sdlPath}` };

  const sdl = readFileSync(sdlPath, 'utf8');
  const root = projectRoot || dir;

  // Try graphql parse via node
  try {
    const parseScript = `
      import { parse } from 'graphql';
      try {
        parse(${JSON.stringify(sdl)});
        console.log('OK');
      } catch (e) {
        console.error(e.message);
        process.exit(1);
      }
    `;
    const tmpFile = join(dir, '.gql-parse-check.mjs');
    const { writeFileSync, unlinkSync } = await import('fs');
    writeFileSync(tmpFile, parseScript);
    try {
      execFileSync('node', [tmpFile], { cwd: root, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
      unlinkSync(tmpFile);
      return { pass: true, code: 'GS002', message: `SDL parses successfully (${sdl.split('\n').length} lines)` };
    } catch (err) {
      unlinkSync(tmpFile);
      return { pass: false, code: 'GS002', message: `SDL parse error: ${(err.stderr || err.stdout || '').trim().slice(0, 200)}` };
    }
  } catch {
    // Fallback: structural check
    const hasType = /type\s+\w+/.test(sdl);
    const hasQuery = /type\s+Query/.test(sdl);
    const balanced = (sdl.match(/\{/g)||[]).length === (sdl.match(/\}/g)||[]).length;
    if (!hasType) return { pass: false, code: 'GS002', message: 'No type definitions found in SDL' };
    if (!hasQuery) return { pass: false, code: 'GS002', message: 'No Query type found in SDL' };
    if (!balanced) return { pass: false, code: 'GS002', message: 'Unbalanced braces in SDL' };
    return { pass: true, code: 'GS002', message: 'SDL structural check passed (graphql-js not available for full parse)' };
  }
}
