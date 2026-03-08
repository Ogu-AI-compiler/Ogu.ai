/**
 * UI State Appearance Compiler — Runner
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, 'compiler.json'), 'utf8'));

const GATE_MODULES = {
  'spec-valid':          () => import('./gates/spec-valid.mjs'),
  'states-complete':     () => import('./gates/states-complete.mjs'),
  'focus-contrast':      () => import('./gates/focus-contrast.mjs'),
  'disabled-opacity':    () => import('./gates/disabled-opacity.mjs'),
  'unique-visual-change':() => import('./gates/unique-visual-change.mjs'),
  'skeleton-geometry':   () => import('./gates/skeleton-geometry.mjs'),
  'no-todos':            () => import('./gates/no-todos.mjs'),
  'contract-state':      () => import('./gates/contract-state.mjs'),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) {
    return { id: gateId, pass: false, code: 'USA000', message: `Unknown gate: ${gateId}` };
  }
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: 'USA000', message: `Gate threw: ${err.message}`, detail: err.stack };
  }
}

export async function run({ dir, verbose = false } = {}) {
  const startTime = Date.now();
  const ctx = { dir };
  const phase1 = COMPILER.pipeline.find(p => p.id === 'verify');
  const gateOrder = phase1 ? phase1.gates : Object.keys(GATE_MODULES);

  const results = [];
  let passed = 0, failed = 0, skipped = 0;

  for (const gateId of gateOrder) {
    const result = await runGate(gateId, ctx);
    results.push(result);
    if (result.skipped)     skipped++;
    else if (result.pass)   passed++;
    else                    failed++;

    if (verbose) {
      const icon = result.skipped ? '⏭' : result.pass ? '✓' : '✗';
      console.log(`  ${icon} [${result.code}] ${result.message}`);
      if (result.detail && !result.pass) {
        console.log('    ' + String(result.detail).split('\n').slice(0, 8).join('\n    '));
      }
    }
  }

  const overallPass = failed === 0;
  const elapsed = Date.now() - startTime;
  const hash = createHash('sha256').update(JSON.stringify(results)).digest('hex');

  const artifact = {
    compiler: COMPILER.id,
    version: COMPILER.version,
    tier: 'frontend',
    pass: overallPass,
    gatesRun: gateOrder.length,
    passed, failed, skipped,
    hash,
    timestamp: new Date().toISOString(),
    elapsed_ms: elapsed,
    gates: results,
  };

  const specPath = join(dir, 'state-appearance-spec.json');
  if (existsSync(specPath)) {
    try {
      const spec = JSON.parse(readFileSync(specPath, 'utf8'));
      const components = Array.isArray(spec.components) ? spec.components : [];
      artifact.component_count = components.length;
      artifact.state_count = components.reduce((sum, c) =>
        sum + (c.states ? Object.keys(c.states).length : 0), 0
      );
      artifact.has_skeleton = components.some(c => c.states && c.states.skeleton);
    } catch {}
  }

  if (overallPass) {
    writeFileSync(join(dir, 'state-artifact.json'), JSON.stringify(artifact, null, 2));
  }

  return artifact;
}
