#!/usr/bin/env node
/** e2e-spec runner — IR: E2E_SPEC:{framework} */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { phase: 'Parse',      file: 'gates/spec-valid.mjs' },
  { phase: 'Flows',      file: 'gates/critical-paths-defined.mjs' },
  { phase: 'Flows',      file: 'gates/all-flows-multi-route.mjs' },
  { phase: 'Safety',     file: 'gates/baseurl-from-env.mjs' },
  { phase: 'Safety',     file: 'gates/no-hardcoded-credentials.mjs' },
  { phase: 'Safety',     file: 'gates/retries-ci-only.mjs' },
  { phase: 'Artifacts',  file: 'gates/selectors-are-accessible.mjs' },
  { phase: 'Artifacts',  file: 'gates/failure-artifacts-configured.mjs' },
  { phase: 'Quality',    file: 'gates/no-todos.mjs' },
  { phase: 'Attest',     file: 'gates/contract-e2e.mjs' },
];

async function run() {
  const args = process.argv.slice(2);
  const dirArg = args.find(a => a.startsWith('--dir='))?.slice(6) || args[0];
  if (!dirArg) { console.error('Usage: runner.mjs --dir=<path>'); process.exit(1); }
  const dir = resolve(dirArg);
  const projectRoot = args.find(a => a.startsWith('--project-root='))?.slice(15) || dir;
  const verbose = args.includes('--verbose');

  const specPath = join(dir, 'e2e-spec.json');
  if (!existsSync(specPath)) { console.error('FAIL e2e-spec.json not found'); process.exit(1); }
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch (e) { console.error(`FAIL ${e.message}`); process.exit(1); }

  const compilerDir = new URL('.', import.meta.url).pathname;
  let currentPhase = '';
  const results = [];

  console.log(`\nE2E Spec Compiler — framework: ${spec.framework || '?'}, ${(spec.userFlows || []).length} flow(s)`);
  console.log('═'.repeat(52));

  for (const gate of GATES) {
    if (gate.phase !== currentPhase) { currentPhase = gate.phase; console.log(`\n[${currentPhase}]`); }
    const gatePath = join(compilerDir, gate.file);
    if (!existsSync(gatePath)) { console.error(`  ✗ Gate missing: ${gate.file}`); process.exit(1); }
    let mod;
    try { mod = await import(gatePath); } catch (e) { console.error(`  ✗ ${gate.file}: ${e.message}`); process.exit(1); }
    const result = await mod.run({ dir, projectRoot, spec });
    results.push({ gate: gate.file, ...result });
    const icon = result.pass ? '✓' : result.skipped ? '⊘' : '✗';
    console.log(`  ${icon} [${result.code}] ${result.message}${result.skipped ? ' [skipped]' : ''}`);
    if (verbose && result.detail) String(result.detail).split('\n').slice(0, 8).forEach(l => console.log(`      ${l}`));
    if (!result.pass && !result.skipped) {
      if (!verbose && result.detail) console.log(`\n  Detail:\n${String(result.detail).split('\n').slice(0, 8).map(l => '    ' + l).join('\n')}`);
      console.log('\n✗ Compilation failed\n');
      process.exit(1);
    }
  }

  const flows = spec.userFlows || [];
  const artifact = {
    ir_id: `E2E_SPEC:${spec.framework}`,
    framework: spec.framework,
    userFlows: flows.length,
    criticalPaths: flows.filter(f => f.criticalPath).length,
    flowIds: flows.map(f => f.id),
    baseUrl: spec.baseUrl,
    retries: spec.retries || {},
    attestation: {
      hash: createHash('sha256').update(JSON.stringify({ spec, timestamp: new Date().toISOString() })).digest('hex'),
      compiledAt: new Date().toISOString(),
      gates: results.map(r => ({ code: r.code, pass: r.pass, skipped: !!r.skipped })),
    },
  };

  const artifactPath = join(dir, 'e2e-spec-artifact.json');
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.log('\n✓ Compilation complete');
  console.log(`  IR: ${artifact.ir_id}`);
  console.log(`  Flows: ${artifact.userFlows} total, ${artifact.criticalPaths} critical`);
  console.log(`  Hash: ${artifact.attestation.hash.slice(0, 16)}…\n`);
}

run().catch(e => { console.error(`Unexpected error: ${e.message}`); process.exit(1); });
