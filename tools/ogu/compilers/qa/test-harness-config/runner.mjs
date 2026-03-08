#!/usr/bin/env node
/**
 * test-harness-config runner
 * Compiles the project-level test harness configuration into a verified artifact.
 * IR: TEST_HARNESS_CONFIG:{runner}
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { phase: 'Parse',       file: 'gates/spec-valid.mjs' },
  { phase: 'Runner',      file: 'gates/runner-version-pinned.mjs' },
  { phase: 'Runner',      file: 'gates/coverage-provider-explicit.mjs' },
  { phase: 'Environment', file: 'gates/timeout-per-environment.mjs' },
  { phase: 'Environment', file: 'gates/reporters-contain-junit.mjs' },
  { phase: 'Setup',       file: 'gates/global-setup-exists.mjs' },
  { phase: 'Setup',       file: 'gates/mock-strategy-declared.mjs' },
  { phase: 'Quality',     file: 'gates/no-todos.mjs' },
  { phase: 'Attest',      file: 'gates/contract-harness.mjs' },
];

async function run() {
  const args = process.argv.slice(2);
  const dirArg = args.find(a => a.startsWith('--dir='))?.slice(6) || args[0];
  if (!dirArg) { console.error('Usage: runner.mjs --dir=<path>'); process.exit(1); }

  const dir = resolve(dirArg);
  const projectRoot = args.find(a => a.startsWith('--project-root='))?.slice(15) || dir;
  const verbose = args.includes('--verbose');

  const specPath = join(dir, 'test-harness-spec.json');
  if (!existsSync(specPath)) {
    console.error('FAIL test-harness-spec.json not found');
    process.exit(1);
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    console.error(`FAIL test-harness-spec.json invalid JSON: ${e.message}`);
    process.exit(1);
  }

  const compilerDir = new URL('.', import.meta.url).pathname;
  let currentPhase = '';
  const results = [];

  console.log(`\nTest Harness Config Compiler — runner: ${spec.runner || '?'}`);
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
    try { mod = await import(gatePath); } catch (e) {
      console.error(`  ✗ Gate load error (${gate.file}): ${e.message}`);
      process.exit(1);
    }

    const result = await mod.run({ dir, projectRoot, spec });
    results.push({ gate: gate.file, ...result });

    const icon = result.pass ? '✓' : result.skipped ? '⊘' : '✗';
    const suffix = result.skipped ? ' [skipped]' : '';
    console.log(`  ${icon} [${result.code}] ${result.message}${suffix}`);

    if (verbose && result.detail) {
      String(result.detail).split('\n').slice(0, 10).forEach(l => console.log(`      ${l}`));
    }

    if (!result.pass && !result.skipped) {
      if (!verbose && result.detail) {
        console.log(`\n  Detail:\n${String(result.detail).split('\n').slice(0, 8).map(l => '    ' + l).join('\n')}`);
      }
      console.log('\n✗ Compilation failed\n');
      process.exit(1);
    }
  }

  const artifact = {
    ir_id: `TEST_HARNESS_CONFIG:${spec.runner}`,
    runner: spec.runner,
    environments: spec.environments,
    coverage: spec.coverage,
    reporters: spec.reporters,
    timeouts: spec.timeouts || {},
    mockStrategy: spec.mockStrategy,
    globalSetup: spec.globalSetup || null,
    attestation: {
      hash: createHash('sha256')
        .update(JSON.stringify({ spec, timestamp: new Date().toISOString() }))
        .digest('hex'),
      compiledAt: new Date().toISOString(),
      gates: results.map(r => ({ code: r.code, pass: r.pass, skipped: !!r.skipped })),
    },
  };

  const artifactPath = join(dir, 'test-harness-artifact.json');
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

  console.log('\n✓ Compilation complete');
  console.log(`  IR: ${artifact.ir_id}`);
  console.log(`  Environments: ${Object.keys(artifact.environments || {}).join(', ')}`);
  console.log(`  Artifact: ${artifactPath}`);
  console.log(`  Hash: ${artifact.attestation.hash.slice(0, 16)}…\n`);
}

run().catch(e => { console.error(`Unexpected error: ${e.message}`); process.exit(1); });
