#!/usr/bin/env node
/** coverage-policy runner — IR: COVERAGE_POLICY:{project} */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { phase: 'Parse',        file: 'gates/spec-valid.mjs' },
  { phase: 'Thresholds',   file: 'gates/thresholds-consistent.mjs' },
  { phase: 'Thresholds',   file: 'gates/thresholds-realistic.mjs' },
  { phase: 'Anti-Cheat',   file: 'gates/no-assertion-free-tests.mjs' },
  { phase: 'Anti-Cheat',   file: 'gates/fail-build-enforced.mjs' },
  { phase: 'Per-File',     file: 'gates/per-file-globs-valid.mjs' },
  { phase: 'Per-File',     file: 'gates/critical-paths-higher.mjs' },
  { phase: 'Quality',      file: 'gates/no-todos.mjs' },
  { phase: 'Attest',       file: 'gates/contract-coverage.mjs' },
];

async function run() {
  const args = process.argv.slice(2);
  const dirArg = args.find(a => a.startsWith('--dir='))?.slice(6) || args[0];
  if (!dirArg) { console.error('Usage: runner.mjs --dir=<path>'); process.exit(1); }
  const dir = resolve(dirArg);
  const projectRoot = args.find(a => a.startsWith('--project-root='))?.slice(15) || dir;
  const verbose = args.includes('--verbose');

  const specPath = join(dir, 'coverage-policy-spec.json');
  if (!existsSync(specPath)) { console.error('FAIL coverage-policy-spec.json not found'); process.exit(1); }
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch (e) { console.error(`FAIL invalid JSON: ${e.message}`); process.exit(1); }

  const compilerDir = new URL('.', import.meta.url).pathname;
  let currentPhase = '';
  const results = [];

  console.log(`\nCoverage Policy Compiler — global lines:${spec.global?.lines}%`);
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

  const artifact = {
    ir_id: `COVERAGE_POLICY:${spec.project || 'default'}`,
    global: spec.global,
    perFile: spec.perFile || {},
    excludeFromThresholds: spec.excludeFromThresholds || [],
    failBuildBelow: spec.failBuildBelow,
    antiCheatingGates: spec.antiCheatingGates || {},
    attestation: {
      hash: createHash('sha256').update(JSON.stringify({ spec, timestamp: new Date().toISOString() })).digest('hex'),
      compiledAt: new Date().toISOString(),
      gates: results.map(r => ({ code: r.code, pass: r.pass, skipped: !!r.skipped })),
    },
  };

  const artifactPath = join(dir, 'coverage-policy-artifact.json');
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.log('\n✓ Compilation complete');
  console.log(`  IR: ${artifact.ir_id}`);
  console.log(`  Global: lines:${spec.global?.lines}% branches:${spec.global?.branches}% | failBuildBelow: ${spec.failBuildBelow}`);
  console.log(`  Hash: ${artifact.attestation.hash.slice(0, 16)}…\n`);
}

run().catch(e => { console.error(`Unexpected error: ${e.message}`); process.exit(1); });
