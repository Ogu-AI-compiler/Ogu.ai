/**
 * UX Responsive Structure Compiler — Runner
 *
 * Validates responsive-spec.json: breakpoint definitions, tier coverage, content visibility,
 * navigation modes, conflict detection, collapsible regions, and contract.
 * Produces responsive-structure-artifact.json on full pass.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const COMPILER = JSON.parse(readFileSync(join(__dir, 'compiler.json'), 'utf8'));

const GATE_MODULES = {
  'spec-valid':                  () => import('./gates/01-spec-valid.mjs'),
  'all-breakpoints-defined':     () => import('./gates/02-all-breakpoints-defined.mjs'),
  'no-content-loss':             () => import('./gates/03-no-content-loss.mjs'),
  'nav-mode-declared':           () => import('./gates/04-nav-mode-declared.mjs'),
  'no-breakpoint-conflicts':     () => import('./gates/05-no-breakpoint-conflicts.mjs'),
  'hierarchy-collapse':          () => import('./gates/06-hierarchy-collapse.mjs'),
  'contract-responsive-structure': () => import('./gates/07-contract-responsive-structure.mjs'),
};

async function runGate(gateId, ctx) {
  const loader = GATE_MODULES[gateId];
  if (!loader) {
    return { id: gateId, pass: false, code: 'URS000', message: `Unknown gate: ${gateId}` };
  }
  try {
    const mod = await loader();
    const result = await mod.run(ctx);
    return { id: gateId, ...result };
  } catch (err) {
    return { id: gateId, pass: false, code: 'URS000', message: `Gate threw: ${err.message}` };
  }
}

export async function runCompiler({ dir, projectRoot, options = {}, onProgress } = {}) {
  const startTime = Date.now();
  const ctx = { dir, projectRoot };

  let spec = {};
  const specPath = join(dir, 'responsive-spec.json');
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
    writeFileSync(join(dir, 'responsive-structure-artifact.json'), JSON.stringify(artifact, null, 2));
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
  const breakpoints = Array.isArray(spec.breakpoints) ? spec.breakpoints : [];
  const collapsibleRegions = Array.isArray(spec.collapsibleRegions) ? spec.collapsibleRegions : [];

  const hasMobile = breakpoints.some(bp => typeof bp.minWidth === 'number' && bp.minWidth <= 480);
  const hasTablet = breakpoints.some(bp => typeof bp.minWidth === 'number' && bp.minWidth >= 481 && bp.minWidth <= 1023);
  const hasDesktop = breakpoints.some(bp => typeof bp.minWidth === 'number' && bp.minWidth >= 1024);

  const hash = createHash('sha256')
    .update(JSON.stringify(gateResults))
    .digest('hex')
    .slice(0, 16);

  return {
    schema: 'responsive-structure-artifact-v1',
    version: spec.version || null,
    breakpoint_count: breakpoints.length,
    has_mobile: hasMobile,
    has_tablet: hasTablet,
    has_desktop: hasDesktop,
    mobile_only: spec.mobileOnly === true,
    desktop_only: spec.desktopOnly === true,
    has_navigation: typeof spec.navigation === 'object' && spec.navigation !== null,
    collapsible_region_count: collapsibleRegions.length,
    region_count: Array.isArray(spec.regions) ? spec.regions.length : 0,
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
