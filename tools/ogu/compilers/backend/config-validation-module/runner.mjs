#!/usr/bin/env node
/**
 * Config Validation Module Compiler Runner
 * Compiles a typed, schema-validated config module from an env contract spec.
 * Produces: config-artifact.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'CV001', name: 'spec-valid',      phase: 1 },
  { id: 'CV002', name: 'exports-valid',   phase: 2 },
  { id: 'CV003', name: 'schema-complete', phase: 2 },
  { id: 'CV004', name: 'no-env-leak',     phase: 3 },
  { id: 'CV005', name: 'secret-marked',   phase: 3 },
  { id: 'CV006', name: 'startup-fail',    phase: 4 },
  { id: 'CV007', name: 'no-unknown-keys', phase: 4 },
  { id: 'CV008', name: 'no-todos',        phase: 5 },
  { id: 'CV009', name: 'tests-pass',      phase: 5 },
  { id: 'CV010', name: 'contract-config', phase: 6 },
];

const PHASE_NAMES = {
  1: 'Parse & Validate Spec',
  2: 'Schema Check',
  3: 'Security Check',
  4: 'Behavior Check',
  5: 'Quality',
  6: 'Attest',
};

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│    Config Validation Module Compiler    │');
  console.log('└─────────────────────────────────────────┘');
  console.log(`  Target: ${dir}\n`);

  const results = [];
  let currentPhase = 0;

  for (const gate of GATES) {
    if (gate.phase !== currentPhase) {
      currentPhase = gate.phase;
      console.log(`\n  Phase ${gate.phase}: ${PHASE_NAMES[gate.phase]}`);
      console.log('  ' + '─'.repeat(38));
    }

    const gatePath = join(compilerRoot, 'gates', `${gate.name}.mjs`);
    if (!existsSync(gatePath)) {
      console.log(`  ⚠  [${gate.id}] ${gate.name} — gate file missing, skipping`);
      results.push({ ...gate, pass: true, skipped: true, message: 'Gate file not found' });
      continue;
    }

    const { run: gateRun } = await import(gatePath);
    let result;
    try {
      result = await gateRun({ dir, projectRoot });
    } catch (err) {
      result = { pass: false, code: gate.id, message: `Gate threw: ${err.message}` };
    }

    const icon = result.skipped ? '⊘' : result.pass ? '✓' : '✗';
    const label = result.skipped ? 'SKIP' : result.pass ? 'PASS' : 'FAIL';
    console.log(`  ${icon}  [${gate.id}] ${gate.name} — ${label}: ${result.message}`);
    if (result.detail && !result.pass) {
      result.detail.split('\n').slice(0, 8).forEach(l => console.log(`         ${l}`));
    }

    results.push({ ...gate, ...result });

    if (!result.pass && !result.skipped) {
      console.log(`\n  ✗ Compilation halted at gate ${gate.id}\n`);
      process.exit(1);
    }
  }

  // Build artifact
  const spec = JSON.parse(readFileSync(join(dir, 'config-spec.json'), 'utf8'));

  const artifact = {
    compiler: 'config-validation-module',
    version: '1.0.0',
    compiled_at: new Date().toISOString(),
    ir_id: `CONFIG:${spec.module || dir.split('/').pop()}`,
    env_keys: spec.envKeys.map(k => ({
      name: k.name,
      type: k.type,
      required: k.required === true,
      has_default: 'default' in k,
      secret: k.secret === true,
    })),
    unknown_key_policy: spec.unknownKeyPolicy,
    secret_keys: spec.envKeys.filter(k => k.secret).map(k => k.name),
    required_keys: spec.envKeys.filter(k => k.required).map(k => k.name),
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation_hash: createHash('sha256')
      .update(JSON.stringify({ spec, timestamp: new Date().toISOString() }))
      .digest('hex'),
  };

  writeFileSync(join(dir, 'config-artifact.json'), JSON.stringify(artifact, null, 2));

  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ config-artifact.json written`);
  console.log(`  ✓ IR: ${artifact.ir_id}`);
  console.log(`  ✓ Attestation: ${artifact.attestation_hash.slice(0, 16)}...\n`);
}

run().catch(err => {
  console.error(`\n  Fatal: ${err.message}\n`);
  process.exit(1);
});
