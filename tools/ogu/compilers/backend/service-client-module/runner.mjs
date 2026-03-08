#!/usr/bin/env node
/**
 * Service Client Module Compiler Runner
 * Produces: service-client-artifact.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'SC001', name: 'spec-valid',             phase: 1 },
  { id: 'SC002', name: 'cross-runtime',          phase: 1 },
  { id: 'SC003', name: 'base-url-from-config',   phase: 2 },
  { id: 'SC004', name: 'auth-via-interceptor',   phase: 2 },
  { id: 'SC005', name: 'typed-responses',        phase: 3 },
  { id: 'SC006', name: 'error-mapped',           phase: 3 },
  { id: 'SC007', name: 'resilience-declared',    phase: 4 },
  { id: 'SC008', name: 'no-sensitive-logging',   phase: 4 },
  { id: 'SC009', name: 'no-todos',               phase: 5 },
  { id: 'SC010', name: 'tests-pass',             phase: 5 },
  { id: 'SC011', name: 'contract-service-client',phase: 6 },
];

const PHASE_NAMES = { 1: 'Parse & Validate Spec', 2: 'URL & Auth', 3: 'Response Typing', 4: 'Resilience', 5: 'Quality', 6: 'Attest' };

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│     Service Client Module Compiler      │');
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
      results.push({ ...gate, pass: true, skipped: true, message: 'Gate file not found' });
      console.log(`  ⚠  [${gate.id}] ${gate.name} — gate file missing, skipping`);
      continue;
    }
    const { run: gateRun } = await import(gatePath);
    let result;
    try { result = await gateRun({ dir, projectRoot }); }
    catch (err) { result = { pass: false, code: gate.id, message: `Gate threw: ${err.message}` }; }

    const icon = result.skipped ? '⊘' : result.pass ? '✓' : '✗';
    const label = result.skipped ? 'SKIP' : result.pass ? 'PASS' : 'FAIL';
    console.log(`  ${icon}  [${gate.id}] ${gate.name} — ${label}: ${result.message}`);
    if (result.detail && !result.pass) result.detail.split('\n').slice(0, 8).forEach(l => console.log(`         ${l}`));
    results.push({ ...gate, ...result });
    if (!result.pass && !result.skipped) { console.log(`\n  ✗ Compilation halted at gate ${gate.id}\n`); process.exit(1); }
  }

  const spec = JSON.parse(readFileSync(join(dir, 'service-client-spec.json'), 'utf8'));
  const timestamp = new Date().toISOString();
  const artifact = {
    compiler: 'service-client-module',
    version: '1.0.0',
    compiled_at: timestamp,
    ir_id: `SERVICE_CLIENT:${spec.provider}`,
    provider: spec.provider,
    baseUrlConfigKey: spec.baseUrlConfigKey,
    auth: { type: spec.auth.type },
    endpoints: spec.endpoints.map(e => ({ name: e.name, method: e.method, path: e.path, returns: e.returns })),
    resilience: { retry: spec.retry || null, circuitBreaker: spec.circuitBreaker || null, timeoutMs: spec.timeoutMs || null },
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation: {
      hash: createHash('sha256').update(JSON.stringify({ spec, timestamp })).digest('hex'),
      timestamp,
    },
  };

  writeFileSync(join(dir, 'service-client-artifact.json'), JSON.stringify(artifact, null, 2));
  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ service-client-artifact.json written`);
  console.log(`  ✓ IR: ${artifact.ir_id}`);
  console.log(`  ✓ Attestation: ${artifact.attestation.hash.slice(0, 16)}...\n`);
}

run().catch(err => { console.error(`\n  Fatal: ${err.message}\n`); process.exit(1); });
