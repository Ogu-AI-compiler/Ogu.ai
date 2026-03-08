/**
 * UX Copy Structure Compiler — Runner
 *
 * Validates copy-structure-spec.json: unique content ids, typed placeholders,
 * state coverage completeness, character limits on primary slots, i18n interpolation
 * consistency, and experiment variant references.
 * Produces copy-structure-artifact.json on full pass.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, 'compiler.json'), 'utf8'));

const GATE_MODULES = {
  'spec-valid':              () => import('./gates/01-spec-valid.mjs'),
  'unique-content-ids':      () => import('./gates/02-unique-content-ids.mjs'),
  'placeholder-typed':       () => import('./gates/03-placeholder-typed.mjs'),
  'state-coverage':          () => import('./gates/04-state-coverage.mjs'),
  'char-limits':             () => import('./gates/05-char-limits.mjs'),
  'i18n-interpolation':      () => import('./gates/06-i18n-interpolation.mjs'),
  'variant-refs':            () => import('./gates/07-variant-refs.mjs'),
  'contract-copy-structure': () => import('./gates/08-contract-copy-structure.mjs'),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) {
    return { id: gateId, pass: false, code: 'UCS000', message: `Unknown gate: ${gateId}` };
  }
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: 'UCS000', message: `Gate threw: ${err.message}` };
  }
}

export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = join(dir, 'copy-structure-spec.json');
  if (existsSync(specPath)) {
    try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch {}
  }

  const gateResults = [];
  let currentPhase = -1;
  let failed = false;
  const startPhase = options.startPhase ?? 0;

  for (const phase of COMPILER.pipeline) {
    if (phase.phase < startPhase) continue;
    currentPhase = phase.phase;

    for (const gateId of phase.gates) {
      const result = await runGate(gateId, ctx);
      gateResults.push(result);
      onProgress?.(result);

      const gateDef = COMPILER.gates.find(g => g.id === gateId);
      if (!result.pass && !result.skipped && gateDef?.required) {
        failed = true;
        break;
      }
    }

    if (failed) break;
  }

  const passed   = gateResults.filter(g => g.pass && !g.skipped);
  const skipped  = gateResults.filter(g => g.skipped);
  const failures = gateResults.filter(g => !g.pass && !g.skipped);
  const elapsed  = Date.now() - startTime;

  const artifact = failed ? null : buildArtifact({ spec, gateResults, elapsed });
  if (artifact && dir) {
    writeFileSync(join(dir, 'copy-structure-artifact.json'), JSON.stringify(artifact, null, 2));
  }

  return {
    success: !failed,
    compiler: COMPILER.id,
    compiler_version: COMPILER.version,
    dir,
    phases_completed: currentPhase,
    gates: { passed: passed.length, skipped: skipped.length, failed: failures.length },
    gate_results: gateResults,
    failures,
    artifact,
    elapsed_ms: elapsed,
  };
}

function buildArtifact({ spec, gateResults, elapsed }) {
  const slots = Array.isArray(spec.content_slots) ? spec.content_slots : [];

  const priorityBreakdown = { primary: 0, secondary: 0, tertiary: 0 };
  for (const slot of slots) {
    if (Object.prototype.hasOwnProperty.call(priorityBreakdown, slot.priority)) {
      priorityBreakdown[slot.priority]++;
    }
  }

  const slotsWithPlaceholders = slots.filter(
    s => Array.isArray(s.placeholders) && s.placeholders.length > 0
  ).length;

  const slotsWithStateCoverage = slots.filter(
    s => Array.isArray(s.stateCoverage) && s.stateCoverage.length > 0
  ).length;

  const hash = createHash('sha256')
    .update(JSON.stringify(gateResults))
    .digest('hex')
    .slice(0, 16);

  return {
    schema: 'copy-structure-artifact-v1',
    version: spec.version || null,
    feature_id: spec.feature_id || spec.id || null,
    slot_count: slots.length,
    priority_breakdown: priorityBreakdown,
    slots_with_placeholders: slotsWithPlaceholders,
    slots_with_state_coverage: slotsWithStateCoverage,
    gates_passed: gateResults.filter(g => g.pass || g.skipped).map(g => g.id),
    compiled_at: new Date().toISOString(),
    compiler_version: COMPILER.version,
    elapsed_ms: elapsed,
    attestation_hash: hash,
  };
}

export async function runGates(gateIds, ctx) {
  const results = [];
  for (const id of gateIds) results.push(await runGate(id, ctx));
  return results;
}

export function listGates() { return COMPILER.gates; }
export function getCompilerDef() { return COMPILER; }
