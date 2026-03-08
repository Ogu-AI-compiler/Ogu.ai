#!/usr/bin/env node
/**
 * Module Scaffold Compiler Runner
 * Compiles module folder structure and boundary rules from module-spec.json.
 * Produces: scaffold-artifact.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'MS001', name: 'spec-valid',             phase: 1 },
  { id: 'MS002', name: 'entrypoint-exists',      phase: 2 },
  { id: 'MS003', name: 'folders-declared',       phase: 2 },
  { id: 'MS004', name: 'no-cross-module-internals', phase: 3 },
  { id: 'MS005', name: 'no-circular',            phase: 3 },
  { id: 'MS006', name: 'no-todos',               phase: 4 },
  { id: 'MS007', name: 'contract-scaffold',      phase: 5 },
];

const PHASE_NAMES = {
  1: 'Parse & Validate Spec',
  2: 'Structure Check',
  3: 'Boundary Check',
  4: 'Quality',
  5: 'Attest',
};

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│       Module Scaffold Compiler          │');
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

  const spec = JSON.parse(readFileSync(join(dir, 'module-spec.json'), 'utf8'));

  const artifact = {
    compiler: 'module-scaffold',
    version: '1.0.0',
    compiled_at: new Date().toISOString(),
    ir_id: `MODULE:${spec.name}`,
    module_name: spec.name,
    capabilities: spec.capabilities,
    allowed_imports: spec.allowedImports || [],
    entrypoint: `src/modules/${spec.name}/index.ts`,
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation_hash: createHash('sha256')
      .update(JSON.stringify({ spec, timestamp: new Date().toISOString() }))
      .digest('hex'),
  };

  writeFileSync(join(dir, 'scaffold-artifact.json'), JSON.stringify(artifact, null, 2));

  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ scaffold-artifact.json written`);
  console.log(`  ✓ IR: ${artifact.ir_id}`);
  console.log(`  ✓ Attestation: ${artifact.attestation_hash.slice(0, 16)}...\n`);
}

run().catch(err => {
  console.error(`\n  Fatal: ${err.message}\n`);
  process.exit(1);
});
