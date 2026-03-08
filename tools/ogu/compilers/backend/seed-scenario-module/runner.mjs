#!/usr/bin/env node
/**
 * seed-scenario-module runner
 * Compiles a seed scenario into a verified, attestation-stamped artifact.
 * IR: SEED_SCENARIO:{scenarioId}
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  // Phase 1: Parse
  { phase: 'Parse',      file: 'gates/spec-valid.mjs' },
  // Phase 2: Idempotency
  { phase: 'Idempotency', file: 'gates/upsert-only.mjs' },
  // Phase 3: Determinism
  { phase: 'Determinism', file: 'gates/no-random-data.mjs' },
  // Phase 4: Safety
  { phase: 'Safety',     file: 'gates/cleanup-declared.mjs' },
  { phase: 'Safety',     file: 'gates/no-prod-data.mjs' },
  // Phase 5: Quality
  { phase: 'Quality',    file: 'gates/no-todos.mjs' },
  { phase: 'Quality',    file: 'gates/tests-pass.mjs' },
  // Phase 6: Attest
  { phase: 'Attest',     file: 'gates/contract-seed-scenario.mjs' },
];

async function run() {
  const args = process.argv.slice(2);
  const dirArg = args.find(a => a.startsWith('--dir='))?.slice(6) || args[0];
  if (!dirArg) {
    console.error('Usage: runner.mjs --dir=<path>');
    process.exit(1);
  }

  const dir = resolve(dirArg);
  const projectRoot = args.find(a => a.startsWith('--project-root='))?.slice(15) || dir;
  const verbose = args.includes('--verbose');

  // Read spec
  const specPath = join(dir, 'seed-scenario-spec.json');
  if (!existsSync(specPath)) {
    console.error('FAIL seed-scenario-spec.json not found');
    process.exit(1);
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    console.error(`FAIL seed-scenario-spec.json invalid JSON: ${e.message}`);
    process.exit(1);
  }

  const compilerDir = new URL('.', import.meta.url).pathname;
  let currentPhase = '';
  const results = [];

  console.log(`\nSeed Scenario Compiler — ${spec.scenarioId || '(unknown)'}`);
  console.log('═'.repeat(52));

  for (const gate of GATES) {
    if (gate.phase !== currentPhase) {
      currentPhase = gate.phase;
      console.log(`\n[${currentPhase}]`);
    }

    const gatePath = join(compilerDir, gate.file);
    if (!existsSync(gatePath)) {
      console.error(`  ✗ Gate file missing: ${gate.file}`);
      process.exit(1);
    }

    let mod;
    try {
      mod = await import(gatePath);
    } catch (e) {
      console.error(`  ✗ Gate load error (${gate.file}): ${e.message}`);
      process.exit(1);
    }

    const result = await mod.run({ dir, projectRoot, spec });
    results.push({ gate: gate.file, ...result });

    const icon = result.pass ? '✓' : result.skipped ? '⊘' : '✗';
    const suffix = result.skipped ? ' [skipped]' : '';
    console.log(`  ${icon} [${result.code}] ${result.message}${suffix}`);

    if (verbose && result.detail) {
      result.detail.split('\n').slice(0, 10).forEach(l => console.log(`      ${l}`));
    }

    if (!result.pass && !result.skipped) {
      if (!verbose && result.detail) {
        console.log(`\n  Detail:\n${result.detail.split('\n').slice(0, 10).map(l => '    ' + l).join('\n')}`);
      }
      console.log('\n✗ Compilation failed\n');
      process.exit(1);
    }
  }

  // Build artifact
  const artifact = {
    ir_id: `SEED_SCENARIO:${spec.scenarioId}`,
    scenarioId: spec.scenarioId,
    description: spec.description || '',
    environment: spec.environment || 'test',
    entities: spec.entities || [],
    seedOrder: spec.seedOrder || [],
    allowRandom: spec.allowRandom || false,
    hasCleanup: true,
    attestation: {
      hash: createHash('sha256')
        .update(JSON.stringify({ spec, timestamp: new Date().toISOString() }))
        .digest('hex'),
      compiledAt: new Date().toISOString(),
      gates: results.map(r => ({ code: r.code, pass: r.pass, skipped: !!r.skipped })),
    },
  };

  const artifactPath = join(dir, 'seed-scenario-artifact.json');
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

  console.log('\n✓ Compilation complete');
  console.log(`  IR: ${artifact.ir_id}`);
  console.log(`  Entities: ${artifact.entities.length} | Seed order: ${artifact.seedOrder.length} step(s)`);
  console.log(`  Artifact: ${artifactPath}`);
  console.log(`  Hash: ${artifact.attestation.hash.slice(0, 16)}…\n`);
}

run().catch(e => {
  console.error(`Unexpected error: ${e.message}`);
  process.exit(1);
});
