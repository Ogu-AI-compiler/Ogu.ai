/**
 * slice-418.test.mjs — PM Structured PRD tests
 * Tests: validatePRD, simulatePRD, repairPRD, generatePRD(simulate),
 *        prdToMarkdown, savePRD, loadPRD
 * All tests run in simulate mode — no LLM required.
 */

import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  validatePRD,
  simulatePRD,
  repairPRD,
  generatePRD,
  prdToMarkdown,
  savePRD,
  loadPRD,
} from '../../tools/ogu/commands/lib/pm-engine.mjs';
import { planProject } from '../../tools/ogu/commands/lib/cto-planner.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.then(() => { console.log(`  ✓ ${name}`); passed++; })
            .catch(e => { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; });
    } else {
      console.log(`  ✓ ${name}`);
      passed++;
    }
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LOW_PLAN = planProject('A simple portfolio website with contact form', { projectId: 'test-low' });
const MEDIUM_PLAN = planProject('A web app with user auth, database, email notifications and admin dashboard', { projectId: 'test-medium' });
const HIGH_PLAN = planProject('A realtime marketplace with payment via Stripe, OAuth SSO, mobile iOS/Android app and ML recommendations', { projectId: 'test-high' });

// ── validatePRD ───────────────────────────────────────────────────────────────

console.log('\nvalidatePRD');

test('valid PRD passes validation', () => {
  const prd = simulatePRD('test brief', MEDIUM_PLAN);
  const { valid, errors } = validatePRD(prd);
  assert(valid, `expected valid, got errors: ${errors.join(', ')}`);
});

test('null input fails', () => {
  const { valid, errors } = validatePRD(null);
  assert(!valid);
  assert(errors.length > 0);
});

test('missing meta.version fails', () => {
  const prd = simulatePRD('test', MEDIUM_PLAN);
  delete prd.meta.version;
  const { valid, errors } = validatePRD(prd);
  assert(!valid);
  assert(errors.some(e => e.includes('meta.version')));
});

test('missing product.name fails', () => {
  const prd = simulatePRD('test', MEDIUM_PLAN);
  delete prd.product.name;
  const { valid } = validatePRD(prd);
  assert(!valid);
});

test('empty features array fails', () => {
  const prd = simulatePRD('test', MEDIUM_PLAN);
  prd.features = [];
  const { valid, errors } = validatePRD(prd);
  assert(!valid);
  assert(errors.some(e => e.includes('features')));
});

test('invalid priority fails', () => {
  const prd = simulatePRD('test', MEDIUM_PLAN);
  prd.features[0].priority = 'nice-to-have';
  const { valid } = validatePRD(prd);
  assert(!valid);
});

test('missing non_functional fields fails', () => {
  const prd = simulatePRD('test', MEDIUM_PLAN);
  delete prd.non_functional.security;
  const { valid, errors } = validatePRD(prd);
  assert(!valid);
  assert(errors.some(e => e.includes('non_functional.security')));
});

// ── simulatePRD ───────────────────────────────────────────────────────────────

console.log('\nsimulatePRD');

test('returns valid PRD for low plan', () => {
  const prd = simulatePRD('portfolio website', LOW_PLAN);
  const { valid, errors } = validatePRD(prd);
  assert(valid, errors.join(', '));
});

test('returns valid PRD for medium plan', () => {
  const prd = simulatePRD('web app with auth and dashboard', MEDIUM_PLAN);
  const { valid, errors } = validatePRD(prd);
  assert(valid, errors.join(', '));
});

test('returns valid PRD for high plan', () => {
  const prd = simulatePRD('realtime marketplace with payments and mobile', HIGH_PLAN);
  const { valid, errors } = validatePRD(prd);
  assert(valid, errors.join(', '));
});

test('features includes user authentication', () => {
  const prd = simulatePRD('any project', MEDIUM_PLAN);
  const hasAuth = prd.features.some(f => f.title.toLowerCase().includes('auth'));
  assert(hasAuth, 'expected auth feature');
});

test('must-have features have acceptance criteria', () => {
  const prd = simulatePRD('web app with auth', MEDIUM_PLAN);
  const musts = prd.features.filter(f => f.priority === 'must');
  assert(musts.length > 0, 'no must-have features');
  for (const f of musts) {
    assert(f.acceptance_criteria.length > 0, `${f.title} has no AC`);
  }
});

test('payment signal produces payment feature', () => {
  const prd = simulatePRD('app with payment integration via stripe', HIGH_PLAN);
  const hasPay = prd.features.some(f => f.title.toLowerCase().includes('payment'));
  assert(hasPay, 'expected payment feature for payment signal');
});

test('high complexity has more features than low', () => {
  const lowPRD = simulatePRD('simple landing page', LOW_PLAN);
  const highPRD = simulatePRD('realtime marketplace with payments and mobile app', HIGH_PLAN);
  assert(highPRD.features.length > lowPRD.features.length,
    `high(${highPRD.features.length}) should > low(${lowPRD.features.length})`);
});

test('data_entities non-empty', () => {
  const prd = simulatePRD('app with auth', MEDIUM_PLAN);
  assert(prd.data_entities.length > 0, 'no data entities');
  assert(prd.data_entities[0].name, 'entity missing name');
  assert(Array.isArray(prd.data_entities[0].key_fields));
});

test('non_functional has all four fields', () => {
  const prd = simulatePRD('test', MEDIUM_PLAN);
  assert(prd.non_functional.performance, 'missing performance');
  assert(prd.non_functional.security, 'missing security');
  assert(prd.non_functional.reliability, 'missing reliability');
  assert(prd.non_functional.observability, 'missing observability');
});

test('out_of_scope is non-empty array', () => {
  const prd = simulatePRD('test', MEDIUM_PLAN);
  assert(Array.isArray(prd.out_of_scope) && prd.out_of_scope.length > 0);
});

test('success_metrics non-empty', () => {
  const prd = simulatePRD('test', MEDIUM_PLAN);
  assert(Array.isArray(prd.success_metrics) && prd.success_metrics.length > 0);
});

test('meta has brief_hash and blueprint_hash', () => {
  const prd = simulatePRD('test brief', MEDIUM_PLAN);
  assert(prd.meta.brief_hash, 'missing brief_hash');
  assert(prd.meta.blueprint_hash, 'missing blueprint_hash');
});

test('stable output: same brief → same brief_hash', () => {
  const brief = 'A stable test project with auth';
  const prd1 = simulatePRD(brief, MEDIUM_PLAN);
  const prd2 = simulatePRD(brief, MEDIUM_PLAN);
  assertEqual(prd1.meta.brief_hash, prd2.meta.brief_hash);
});

test('feature ids follow feat-NNN format', () => {
  const prd = simulatePRD('test', MEDIUM_PLAN);
  for (const f of prd.features) {
    assert(f.id.startsWith('feat-'), `invalid id: ${f.id}`);
  }
});

test('feature dependencies reference valid feature ids', () => {
  const prd = simulatePRD('app with auth and payments', HIGH_PLAN);
  const ids = new Set(prd.features.map(f => f.id));
  for (const f of prd.features) {
    for (const dep of (f.dependencies || [])) {
      assert(ids.has(dep), `feature ${f.id} depends on unknown ${dep}`);
    }
  }
});

test('object brief is handled gracefully', () => {
  const prd = simulatePRD({ idea: 'web app', type: 'saas' }, MEDIUM_PLAN);
  const { valid } = validatePRD(prd);
  assert(valid);
});

// ── repairPRD ─────────────────────────────────────────────────────────────────

console.log('\nrepairPRD');

test('strips markdown fences from LLM output', () => {
  const fakeJson = JSON.stringify(simulatePRD('test', MEDIUM_PLAN));
  const wrapped = '```json\n' + fakeJson + '\n```';
  const repaired = repairPRD(wrapped, 'test', MEDIUM_PLAN);
  const { valid } = validatePRD(repaired);
  assert(valid, 'repaired PRD should be valid');
});

test('falls back to simulate on invalid JSON', () => {
  const result = repairPRD('this is not json at all {{{}', 'test brief', MEDIUM_PLAN);
  assert(result.features, 'fallback should have features');
  assert(result.meta, 'fallback should have meta');
});

test('patches missing fields in partial JSON', () => {
  const partial = JSON.stringify({ features: [], product: { name: 'X' } });
  const result = repairPRD(partial, 'test', MEDIUM_PLAN);
  assert(Array.isArray(result.out_of_scope));
  assert(result.meta?.version);
});

test('null input falls back to simulate', () => {
  const result = repairPRD(null, 'test', MEDIUM_PLAN);
  assert(result.features?.length > 0);
});

// ── generatePRD (simulate mode) ───────────────────────────────────────────────

console.log('\ngeneratePRD (simulate)');

await testAsync('returns valid PRD in simulate mode', async () => {
  const prd = await generatePRD('A web app with auth', MEDIUM_PLAN, { simulate: true });
  const { valid, errors } = validatePRD(prd);
  assert(valid, errors.join(', '));
});

await testAsync('simulate mode is deterministic', async () => {
  const brief = 'deterministic test project';
  const p1 = await generatePRD(brief, MEDIUM_PLAN, { simulate: true });
  const p2 = await generatePRD(brief, MEDIUM_PLAN, { simulate: true });
  assertEqual(p1.meta.brief_hash, p2.meta.brief_hash);
  assertEqual(p1.features.length, p2.features.length);
});

// ── prdToMarkdown ─────────────────────────────────────────────────────────────

console.log('\nprdToMarkdown');

test('returns non-empty string', () => {
  const prd = simulatePRD('test', MEDIUM_PLAN);
  const md = prdToMarkdown(prd);
  assert(typeof md === 'string' && md.length > 100);
});

test('contains product name as heading', () => {
  const prd = simulatePRD('MyApp test project', MEDIUM_PLAN);
  const md = prdToMarkdown(prd);
  assert(md.includes('# PRD:'), 'missing heading');
});

test('contains all feature titles', () => {
  const prd = simulatePRD('test', MEDIUM_PLAN);
  const md = prdToMarkdown(prd);
  for (const f of prd.features) {
    assert(md.includes(f.title), `markdown missing feature: ${f.title}`);
  }
});

test('contains non-functional section', () => {
  const prd = simulatePRD('test', MEDIUM_PLAN);
  const md = prdToMarkdown(prd);
  assert(md.includes('Non-Functional'));
});

test('contains out of scope section', () => {
  const prd = simulatePRD('test', MEDIUM_PLAN);
  const md = prdToMarkdown(prd);
  assert(md.includes('Out of Scope'));
});

// ── savePRD / loadPRD ─────────────────────────────────────────────────────────

console.log('\nsavePRD / loadPRD');

let tmpDir;

test('savePRD creates prd.json', () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ogu-prd-'));
  const prd = simulatePRD('save test', MEDIUM_PLAN);
  savePRD(tmpDir, 'proj-save', prd);
  assert(existsSync(join(tmpDir, '.ogu', 'projects', 'proj-save', 'prd.json')));
});

test('loadPRD returns saved PRD', () => {
  const prd = simulatePRD('load test', MEDIUM_PLAN);
  savePRD(tmpDir, 'proj-load', prd);
  const loaded = loadPRD(tmpDir, 'proj-load');
  assert(loaded !== null);
  assert(loaded.meta?.version === '1.0');
  assert(Array.isArray(loaded.features));
});

test('loadPRD returns null for missing project', () => {
  assert(loadPRD(tmpDir, 'nonexistent-xyz') === null);
});

test('savePRD with writeMarkdown creates prd.md', () => {
  const prd = simulatePRD('markdown test', MEDIUM_PLAN);
  savePRD(tmpDir, 'proj-md', prd, { writeMarkdown: true });
  assert(existsSync(join(tmpDir, '.ogu', 'projects', 'proj-md', 'prd.json')));
  assert(existsSync(join(tmpDir, '.ogu', 'projects', 'proj-md', 'prd.md')));
});

test('saved PRD passes validation after load', () => {
  const prd = simulatePRD('roundtrip test', HIGH_PLAN);
  savePRD(tmpDir, 'proj-roundtrip', prd);
  const loaded = loadPRD(tmpDir, 'proj-roundtrip');
  const { valid, errors } = validatePRD(loaded);
  assert(valid, errors.join(', '));
});

// Cleanup
try { if (tmpDir) rmSync(tmpDir, { recursive: true, force: true }); } catch {}

// ── Summary ───────────────────────────────────────────────────────────────────

// Wait for any pending async tests
await new Promise(r => setTimeout(r, 100));

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
