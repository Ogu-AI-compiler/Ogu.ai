/**
 * UI Typography Scale Compiler — Runner
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
  'steps-complete':      () => import('./gates/steps-complete.mjs'),
  'min-font-size':       () => import('./gates/min-font-size.mjs'),
  'body-line-height':    () => import('./gates/body-line-height.mjs'),
  'no-negative-tracking':() => import('./gates/no-negative-tracking.mjs'),
  'i18n-stacks':         () => import('./gates/i18n-stacks.mjs'),
  'no-todos':            () => import('./gates/no-todos.mjs'),
  'contract-typography': () => import('./gates/contract-typography.mjs'),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) {
    return { id: gateId, pass: false, code: 'UTS000', message: `Unknown gate: ${gateId}` };
  }
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: 'UTS000', message: `Gate threw: ${err.message}`, detail: err.stack };
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

  const specPath = join(dir, 'typography-scale-spec.json');
  if (existsSync(specPath)) {
    try {
      const spec = JSON.parse(readFileSync(specPath, 'utf8'));
      artifact.step_count = Array.isArray(spec.steps) ? spec.steps.length : 0;
      artifact.base_size = spec.baseSize || spec.base || null;
      artifact.scale_ratio = spec.scaleRatio || spec.ratio || null;
      artifact.has_i18n_stacks = !!(spec.i18n && spec.i18n.fontStacks);
    } catch {}
  }

  if (overallPass) {
    writeFileSync(join(dir, 'typography-artifact.json'), JSON.stringify(artifact, null, 2));
  }

  return artifact;
}
