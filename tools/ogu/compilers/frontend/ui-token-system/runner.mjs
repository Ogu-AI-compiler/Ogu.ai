/**
 * UI Token System Compiler — Runner
 *
 * Executes all 9 gates against a design-token-spec.json and produces
 * a signed token-artifact.json on full pass.
 *
 * Usage:
 *   import { run } from './runner.mjs';
 *   const result = await run({ dir: '/path/to/token-dir', verbose: true });
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, 'compiler.json'), 'utf8'));

const GATE_MODULES = {
  'spec-valid':               () => import('./gates/spec-valid.mjs'),
  'tokens-unique':            () => import('./gates/tokens-unique.mjs'),
  'alias-resolves':           () => import('./gates/alias-resolves.mjs'),
  'no-circular':              () => import('./gates/no-circular.mjs'),
  'semantic-aliases-only':    () => import('./gates/semantic-aliases-only.mjs'),
  'component-aliases-semantic': () => import('./gates/component-aliases-semantic.mjs'),
  'naming-convention':        () => import('./gates/naming-convention.mjs'),
  'no-todos':                 () => import('./gates/no-todos.mjs'),
  'contract-tokens':          () => import('./gates/contract-tokens.mjs'),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) {
    return { id: gateId, pass: false, code: 'UIT000', message: `Unknown gate: ${gateId}` };
  }
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return {
      id: gateId,
      pass: false,
      code: 'UIT000',
      message: `Gate threw: ${err.message}`,
      detail: err.stack,
    };
  }
}

export async function run({ dir, verbose = false } = {}) {
  const startTime = Date.now();
  const ctx = { dir };

  // Determine gate order from compiler.json pipeline phase 1
  const phase1 = COMPILER.pipeline.find(p => p.id === 'verify');
  const gateOrder = phase1 ? phase1.gates : Object.keys(GATE_MODULES);

  const results = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const gateId of gateOrder) {
    const result = await runGate(gateId, ctx);
    results.push(result);

    if (result.skipped) {
      skipped++;
    } else if (result.pass) {
      passed++;
    } else {
      failed++;
    }

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
    passed,
    failed,
    skipped,
    hash,
    timestamp: new Date().toISOString(),
    elapsed_ms: elapsed,
    gates: results,
  };

  // Enrich artifact with token counts when spec is readable
  const specPath = join(dir, 'design-token-spec.json');
  if (existsSync(specPath)) {
    try {
      const spec = JSON.parse(readFileSync(specPath, 'utf8'));
      const tokens = Array.isArray(spec.tokens) ? spec.tokens : [];
      artifact.token_count = tokens.length;
      artifact.primitive_count = tokens.filter(t => t.tier === 'primitive').length;
      artifact.semantic_count = tokens.filter(t => t.tier === 'semantic').length;
      artifact.component_count = tokens.filter(t => t.tier === 'component').length;
    } catch {
      // Non-fatal — gate spec-valid will have already caught this
    }
  }

  // Only write the artifact JSON on full pass — never write a partial artifact
  if (overallPass) {
    writeFileSync(join(dir, 'token-artifact.json'), JSON.stringify(artifact, null, 2));
  }

  return artifact;
}
