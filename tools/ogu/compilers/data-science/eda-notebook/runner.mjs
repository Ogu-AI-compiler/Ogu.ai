import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __dir  = fileURLToPath(new URL('.', import.meta.url));
const CONFIG = JSON.parse(readFileSync(join(__dir, 'compiler.json'), 'utf8'));

/** Build a lookup: gate-name → { id, phase } */
const GATE_META = Object.fromEntries(
  CONFIG.gates.map(g => [g.name, g])
);

const PHASE_NAMES = Object.fromEntries(
  (CONFIG.phases || []).map(p => [p.id, p.name])
);

// ─── Importable API ──────────────────────────────────────────────────────────

/**
 * Run the compiler programmatically and return the full artifact.
 * Does NOT write to stdout or call process.exit.
 *
 * @param {{ dir: string, projectRoot?: string, verbose?: boolean }} opts
 * @returns {Promise<object>} artifact
 */
export async function run({ dir, projectRoot, verbose = false }) {
  const gatesDir  = join(__dir, 'gates');
  const gateOrder = CONFIG.gates.map(g => g.name);

  const results = [];
  let passed = 0, failed = 0, skipped = 0;

  for (const gateName of gateOrder) {
    const gatePath = join(gatesDir, `${gateName}.mjs`);
    if (!existsSync(gatePath)) {
      results.push({ gate: gateName, pass: true, skipped: true, code: 'MISSING', message: 'Gate file not found' });
      skipped++;
      continue;
    }

    const { run: gateRun } = await import(gatePath);
    let result;
    try {
      result = await gateRun({ dir, projectRoot });
    } catch (err) {
      result = { pass: false, code: 'RUNTIME', message: `Gate threw: ${err.message}`, detail: err.stack };
    }

    const meta = GATE_META[gateName] || {};
    results.push({ gate: gateName, id: meta.id, phase: meta.phase, ...result });

    if (result.skipped)    skipped++;
    else if (result.pass)  passed++;
    else                   failed++;

    if (verbose && !result.pass && !result.skipped) {
      process.stderr.write(`  ✗ [${result.code}] ${result.message}\n`);
      if (result.detail) process.stderr.write(`    ${String(result.detail).replace(/\n/g, '\n    ')}\n`);
    }
  }

  const overallPass = failed === 0;
  const hash = createHash('sha256').update(JSON.stringify(results)).digest('hex');

  const artifact = {
    compiler:   CONFIG.id,
    title:      CONFIG.title,
    version:    CONFIG.version,
    tier:       CONFIG.tier,
    ir_id:      CONFIG.ir?.identifier ?? CONFIG.id.toUpperCase().replace(/-/g, '_'),
    pass:       overallPass,
    gatesRun:   CONFIG.gates.length,
    passed,
    failed,
    skipped,
    hash,
    timestamp:  new Date().toISOString(),
    gates:      results,
  };

  writeFileSync(join(dir, CONFIG.ir.output_artifact), JSON.stringify(artifact, null, 2));
  return artifact;
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

async function runCli() {
  const dir = resolve(process.argv[2] || process.cwd());
  const width = 46;
  const title = CONFIG.title;
  const pad = Math.max(0, width - title.length - 2);

  console.log('\n┌' + '─'.repeat(width) + '┐');
  console.log('│  ' + title + ' '.repeat(pad) + '│');
  console.log('└' + '─'.repeat(width) + '┘');
  console.log(`  Target : ${dir}`);
  console.log(`  Tier   : ${CONFIG.tier}  |  Language: ${CONFIG.language}\n`);

  const gatesDir  = join(__dir, 'gates');
  const gateOrder = CONFIG.gates.map(g => g.name);

  const results    = [];
  let currentPhase = 0;
  let phaseHadFail = false;

  for (const gateName of gateOrder) {
    const meta      = GATE_META[gateName] || {};
    const phaseId   = meta.phase ?? 0;
    const phaseName = PHASE_NAMES[phaseId] ?? `Phase ${phaseId}`;

    if (phaseId !== currentPhase) {
      if (phaseHadFail) {
        console.log(`\n  ✗ Phase ${currentPhase} failed — compilation halted\n`);
        process.exit(1);
      }
      currentPhase = phaseId;
      phaseHadFail = false;
      console.log(`\n  Phase ${phaseId}: ${phaseName}`);
      console.log('  ' + '─'.repeat(40));
    }

    const gatePath = join(gatesDir, `${gateName}.mjs`);
    if (!existsSync(gatePath)) {
      console.log(`  ⊘  [${meta.id ?? '?'}] ${gateName} — gate file missing`);
      results.push({ gate: gateName, pass: true, skipped: true });
      continue;
    }

    const { run: gateRun } = await import(gatePath);
    let result;
    try {
      result = await gateRun({ dir });
    } catch (err) {
      result = { pass: false, code: meta.id, message: `Gate threw: ${err.message}` };
    }

    const icon  = result.skipped ? '⊘' : result.pass ? '✓' : '✗';
    const label = result.skipped ? 'SKIP' : result.pass ? 'PASS' : 'FAIL';
    console.log(`  ${icon}  [${meta.id ?? result.code}] ${gateName} — ${label}: ${result.message}`);

    if (result.detail && !result.pass) {
      String(result.detail).split('\n').slice(0, 6).forEach(l => console.log(`       ${l}`));
    }

    results.push({ gate: gateName, id: meta.id, phase: phaseId, ...result });
    if (!result.pass && !result.skipped) phaseHadFail = true;
  }

  const failed     = results.filter(r => !r.pass && !r.skipped).length;
  const passed     = results.filter(r =>  r.pass && !r.skipped).length;
  const skipped    = results.filter(r =>  r.skipped).length;
  const overallPass = failed === 0;
  const hash = createHash('sha256').update(JSON.stringify(results)).digest('hex');

  const artifact = {
    compiler:  CONFIG.id,
    title:     CONFIG.title,
    version:   CONFIG.version,
    tier:      CONFIG.tier,
    ir_id:     CONFIG.ir?.identifier ?? CONFIG.id.toUpperCase().replace(/-/g, '_'),
    pass:      overallPass,
    gatesRun:  CONFIG.gates.length,
    passed, failed, skipped,
    hash,
    timestamp: new Date().toISOString(),
    gates:     results,
  };

  writeFileSync(join(dir, CONFIG.ir.output_artifact), JSON.stringify(artifact, null, 2));

  console.log('\n' + '─'.repeat(48));
  if (overallPass) {
    console.log(`  ✓ All gates passed  (${passed} passed, ${skipped} skipped)`);
    console.log(`  ✓ Artifact: ${CONFIG.ir.output_artifact}`);
    console.log(`  ✓ Attestation: ${hash.slice(0, 16)}...\n`);
  } else {
    console.log(`  ✗ Compilation failed  (${passed} passed, ${failed} failed, ${skipped} skipped)`);
    console.log(`  ✗ Fix the ${failed} failing gate(s) above and re-run\n`);
    process.exit(1);
  }
}

// Run CLI when invoked directly
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCli().catch(err => { console.error(`\n  Fatal: ${err.message}\n`); process.exit(1); });
}
