import { createHash } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';

const GATES = ['spec-valid','axe-wrapper','wcag-level-declared','storybook-addon','no-todos','cross-storybook','contract-a11y-harness'];
const dir = new URL('.', import.meta.url).pathname;

export async function run({ dir: targetDir, projectRoot } = {}) {
  const results = [];
  for (const gate of GATES) {
    const { run } = await import(`${dir}gates/${gate}.mjs`);
    const result = await run({ dir: targetDir || process.cwd(), projectRoot });
    results.push({ gate, ...result });
    if (!result.pass && !result.skipped) break;
  }
  const passed = results.every(r => r.pass || r.skipped);
  const artifact = { compiler: 'a11y-harness-config', pass: passed, timestamp: new Date().toISOString(), gates: results, attestation: createHash('sha256').update(JSON.stringify(results)).digest('hex') };
  if (targetDir) writeFileSync(join(targetDir, 'a11y-harness-artifact.json'), JSON.stringify(artifact, null, 2));
  return artifact;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  run({ dir: process.argv[2] || process.cwd(), projectRoot: process.argv[3] }).then(r => { console.log(r.pass ? '✓ PASS' : '✗ FAIL'); r.gates.forEach(g => console.log(`  [${g.pass ? '✓' : g.skipped ? '~' : '✗'}] ${g.gate}: ${g.message}`)); process.exit(r.pass ? 0 : 1); });
}
