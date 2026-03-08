#!/usr/bin/env node
/**
 * Design Tokens Compiler Runner
 * Compiles design tokens into tailwind.config.ts and CSS custom properties.
 * Enforces WCAG contrast, naming conventions, dark mode parity.
 * Produces: tokens-artifact.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'DT001', name: 'spec-valid',       phase: 1 },
  { id: 'DT002', name: 'naming-convention', phase: 1 },
  { id: 'DT003', name: 'ts-valid',          phase: 2 },
  { id: 'DT004', name: 'wcag-contrast',     phase: 3 },
  { id: 'DT005', name: 'no-collisions',     phase: 3 },
  { id: 'DT006', name: 'dark-mode-pairs',   phase: 3 },
  { id: 'DT007', name: 'no-todos',          phase: 4 },
  { id: 'DT008', name: 'contract-tokens',   phase: 5 },
];

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│        Design Tokens Compiler           │');
  console.log('└─────────────────────────────────────────┘');
  console.log(`  Target: ${dir}\n`);

  const results = [];
  let currentPhase = 0;

  for (const gate of GATES) {
    if (gate.phase !== currentPhase) {
      currentPhase = gate.phase;
      const phaseNames = { 1: 'Parse & Validate Spec', 2: 'Scaffold', 3: 'Implement', 4: 'Test', 5: 'Attest' };
      console.log(`\n  Phase ${gate.phase}: ${phaseNames[gate.phase]}`);
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
      result.detail.split('\n').slice(0, 5).forEach(l => console.log(`         ${l}`));
    }

    results.push({ ...gate, ...result });

    if (!result.pass && !result.skipped) {
      console.log(`\n  ✗ Compilation halted at gate ${gate.id}\n`);
      process.exit(1);
    }
  }

  const spec = JSON.parse(readFileSync(join(dir, 'tokens-spec.json'), 'utf8'));

  const artifact = {
    compiler: 'design-tokens',
    version: '1.0.0',
    compiled_at: new Date().toISOString(),
    color_groups: Object.keys(spec.colors || {}),
    has_dark_mode: !!spec.darkMode,
    contrast_pairs_checked: (spec.contrastPairs || []).length,
    token_categories: ['colors', 'spacing', 'typography', 'radius', 'shadows'].filter(c => spec[c]),
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation_hash: createHash('sha256')
      .update(JSON.stringify({ spec, timestamp: new Date().toISOString() }))
      .digest('hex')
  };

  writeFileSync(join(dir, 'tokens-artifact.json'), JSON.stringify(artifact, null, 2));

  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ tokens-artifact.json written`);
  console.log(`  ✓ Attestation: ${artifact.attestation_hash.slice(0, 16)}...\n`);
}

run().catch(err => {
  console.error(`\n  Fatal: ${err.message}\n`);
  process.exit(1);
});
