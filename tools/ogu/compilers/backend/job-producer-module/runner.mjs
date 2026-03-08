#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'JP001', name: 'spec-valid',               phase: 1 },
  { id: 'JP002', name: 'cross-topology',           phase: 1 },
  { id: 'JP003', name: 'payload-validated',        phase: 2 },
  { id: 'JP004', name: 'queue-name-from-topology', phase: 2 },
  { id: 'JP005', name: 'no-fire-and-forget',       phase: 3 },
  { id: 'JP006', name: 'options-from-spec',        phase: 3 },
  { id: 'JP007', name: 'no-todos',                 phase: 4 },
  { id: 'JP008', name: 'tests-pass',               phase: 4 },
  { id: 'JP009', name: 'contract-job-producer',    phase: 5 },
];

const PHASE_NAMES = { 1: 'Parse & Validate Spec', 2: 'Enqueue Contract', 3: 'Reliability', 4: 'Quality', 5: 'Attest' };

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│      Job Producer Module Compiler       │');
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
    if (!existsSync(gatePath)) { results.push({ ...gate, pass: true, skipped: true }); console.log(`  ⚠  [${gate.id}] ${gate.name} — skipped`); continue; }
    const { run: gateRun } = await import(gatePath);
    let result;
    try { result = await gateRun({ dir, projectRoot }); }
    catch (err) { result = { pass: false, code: gate.id, message: `Gate threw: ${err.message}` }; }
    const icon = result.skipped ? '⊘' : result.pass ? '✓' : '✗';
    const label = result.skipped ? 'SKIP' : result.pass ? 'PASS' : 'FAIL';
    console.log(`  ${icon}  [${gate.id}] ${gate.name} — ${label}: ${result.message}`);
    if (result.detail && !result.pass) result.detail.split('\n').slice(0, 8).forEach(l => console.log(`         ${l}`));
    results.push({ ...gate, ...result });
    if (!result.pass && !result.skipped) { console.log(`\n  ✗ Halted at ${gate.id}\n`); process.exit(1); }
  }

  const spec = JSON.parse(readFileSync(join(dir, 'job-producer-spec.json'), 'utf8'));
  const timestamp = new Date().toISOString();
  const artifact = {
    compiler: 'job-producer-module', version: '1.0.0', compiled_at: timestamp,
    ir_id: `JOB_PRODUCER:${spec.jobName}`,
    jobName: spec.jobName, queueName: spec.queueName, payloadSchema: spec.payloadSchema,
    options: spec.options || null,
    gates_passed: results.filter(r => r.pass || r.skipped).length, gates_total: results.length,
    attestation: { hash: createHash('sha256').update(JSON.stringify({ spec, timestamp })).digest('hex'), timestamp },
  };

  writeFileSync(join(dir, 'job-producer-artifact.json'), JSON.stringify(artifact, null, 2));
  console.log(`\n  ✓ job-producer-artifact.json written — IR: ${artifact.ir_id}\n`);
}

run().catch(err => { console.error(`\n  Fatal: ${err.message}\n`); process.exit(1); });
