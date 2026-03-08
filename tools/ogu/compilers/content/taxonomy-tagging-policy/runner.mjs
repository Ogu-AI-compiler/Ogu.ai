import { readdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { createHash } from 'crypto';

const GATES_DIR = fileURLToPath(new URL('./gates/', import.meta.url));
const COMPILER  = 'taxonomy-tagging-policy';
const ARTIFACT  = 'taxonomy-policy.json';

export async function run({ dir, verbose = false }) {
  const gateFiles = readdirSync(GATES_DIR).filter(f => f.endsWith('.mjs')).sort();
  const results   = [];
  let passed = 0, failed = 0, skipped = 0;

  for (const gateFile of gateFiles) {
    const gateModule = await import(join(GATES_DIR, gateFile));
    let result;
    try {
      result = await gateModule.run({ dir });
    } catch (err) {
      result = { pass: false, code: 'RUNTIME', message: `Gate threw: ${err.message}` };
    }

    results.push({ gate: gateFile.replace('.mjs', ''), ...result });

    if (result.skipped)        skipped++;
    else if (result.pass)      passed++;
    else                       failed++;

    if (verbose) {
      const icon = result.skipped ? '⏭' : result.pass ? '✓' : '✗';
      console.log(`  ${icon} [${result.code}] ${result.message}`);
      if (result.detail && !result.pass) {
        console.log('    ' + String(result.detail).split('\n').slice(0, 8).join('\n    '));
      }
    }
  }

  const overallPass = failed === 0;
  const hash = createHash('sha256').update(JSON.stringify(results)).digest('hex');

  const artifact = {
    compiler:  COMPILER,
    version:   '1.0.0',
    tier:      'content',
    pass:      overallPass,
    gatesRun:  gateFiles.length,
    passed,
    failed,
    skipped,
    hash,
    timestamp: new Date().toISOString(),
    gates:     results,
  };

  if (overallPass) {
    writeFileSync(join(dir, ARTIFACT), JSON.stringify(artifact, null, 2));
  }

  return artifact;
}
