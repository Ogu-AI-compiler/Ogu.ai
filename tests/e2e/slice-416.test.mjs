/**
 * slice-416.test.mjs — CTO Planner tests
 * Tests: assessComplexity, buildTeamBlueprint, buildWorkFramework, planProject,
 *        saveCTOPlan, loadCTOPlan
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import {
  assessComplexity,
  buildTeamBlueprint,
  buildWorkFramework,
  planProject,
  saveCTOPlan,
  loadCTOPlan,
} from '../../tools/ogu/commands/lib/cto-planner.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
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

// ── assessComplexity ──────────────────────────────────────────────────────────

console.log('\nassessComplexity');

test('simple brief → low tier', () => {
  const r = assessComplexity('A simple CRUD landing page prototype');
  assertEqual(r.tier, 'low');
  assert(r.score < 2, `score should be < 2, got ${r.score}`);
});

test('medium brief → medium tier', () => {
  const r = assessComplexity('A web app with authentication, database, email notifications and admin dashboard');
  assertEqual(r.tier, 'medium');
  assert(r.score >= 2);
});

test('complex brief → high tier', () => {
  const r = assessComplexity('A realtime marketplace with payment processing via Stripe, OAuth SSO, mobile app for iOS and Android, and machine learning recommendations');
  assertEqual(r.tier, 'high');
  assert(r.score >= 6);
});

test('detects high signals correctly', () => {
  const r = assessComplexity('We need websocket support and payment integration via stripe');
  assert(r.signals.high.length >= 2, `expected ≥2 high signals, got ${r.signals.high.length}`);
});

test('detects medium signals correctly', () => {
  const r = assessComplexity('App with authentication, search, and file upload');
  assert(r.signals.medium.length >= 2);
});

test('detects product type: marketplace', () => {
  const r = assessComplexity('A marketplace connecting buyers and sellers with listings');
  assertEqual(r.product_type, 'marketplace');
});

test('detects product type: saas', () => {
  const r = assessComplexity('A multi-tenant SaaS platform with workspace management');
  assertEqual(r.product_type, 'saas');
});

test('detects product type: ecommerce', () => {
  const r = assessComplexity('An e-commerce store with product catalog and checkout');
  assertEqual(r.product_type, 'ecommerce');
});

test('returns risk_factors for high signals', () => {
  const r = assessComplexity('App with payment integration and OAuth SSO');
  assert(r.risk_factors.length > 0, 'should have risk factors');
  assert(r.risk_factors.some(f => f.includes('payment') || f.includes('identity')));
});

test('integrations detected from high signals', () => {
  const r = assessComplexity('Integrate with stripe for payment and oauth for login');
  assert(r.integrations.length > 0);
});

test('object brief coerced to string', () => {
  const r = assessComplexity({ idea: 'A simple landing page', type: 'portfolio' });
  assertEqual(r.tier, 'low');
});

test('empty brief → low tier', () => {
  const r = assessComplexity('');
  assertEqual(r.tier, 'low');
  assertEqual(r.score, 0);
});

// ── buildTeamBlueprint ────────────────────────────────────────────────────────

console.log('\nbuildTeamBlueprint');

test('low complexity → 4-5 roles', () => {
  const c = assessComplexity('simple crud app');
  const bp = buildTeamBlueprint(c, 'simple crud app');
  assert(bp.roles.length >= 4, `expected ≥4 roles, got ${bp.roles.length}`);
  assert(bp.total_headcount >= 4);
});

test('medium complexity → includes frontend + backend', () => {
  const c = assessComplexity('web app with auth and dashboard');
  const bp = buildTeamBlueprint(c, 'web app with auth and dashboard');
  const roles = bp.roles.map(r => r.role_id);
  assert(roles.includes('backend_engineer'));
});

test('high complexity → includes devops and architect x2', () => {
  const c = assessComplexity('realtime websocket platform with payments and mobile app');
  const bp = buildTeamBlueprint(c, 'realtime websocket platform with payments and mobile app');
  const arch = bp.roles.find(r => r.role_id === 'architect');
  assert(arch, 'architect role missing');
  assert(arch.count >= 2, `expected architect count ≥2, got ${arch.count}`);
});

test('always includes pm and qa', () => {
  const c = assessComplexity('any project');
  const bp = buildTeamBlueprint(c, 'any project');
  const roles = bp.roles.map(r => r.role_id);
  assert(roles.includes('pm'));
  assert(roles.includes('qa'));
});

test('roles have rationale', () => {
  const c = assessComplexity('web app');
  const bp = buildTeamBlueprint(c, 'web app');
  for (const r of bp.roles) {
    assert(r.rationale && r.rationale.length > 0, `role ${r.role_id} missing rationale`);
  }
});

test('has blueprint_id', () => {
  const c = assessComplexity('app');
  const bp = buildTeamBlueprint(c);
  assert(bp.blueprint_id.startsWith('bp_'));
});

test('complexity_tier matches input', () => {
  const c = { tier: 'high', score: 9, product_type: 'platform', signals: { high: [], medium: [], low: [] }, risk_factors: [], integrations: [] };
  const bp = buildTeamBlueprint(c);
  assertEqual(bp.complexity_tier, 'high');
});

test('adds frontend when UI keywords in brief', () => {
  const c = { tier: 'low', score: 0, product_type: 'general', signals: { high: [], medium: [], low: [] }, risk_factors: [], integrations: [] };
  const bp = buildTeamBlueprint(c, 'build a react interface with multiple screens and ui components');
  const roles = bp.roles.map(r => r.role_id);
  assert(roles.includes('frontend_engineer'), 'should add frontend_engineer for UI brief');
});

test('total_headcount = sum of all role counts', () => {
  const c = assessComplexity('web app with auth');
  const bp = buildTeamBlueprint(c, 'web app with auth');
  const sumCounts = bp.roles.reduce((s, r) => s + r.count, 0);
  assertEqual(bp.total_headcount, sumCounts);
});

// ── buildWorkFramework ────────────────────────────────────────────────────────

console.log('\nbuildWorkFramework');

test('low → monolith architecture', () => {
  const c = { tier: 'low' };
  const fw = buildWorkFramework(c);
  assertEqual(fw.architecture_type, 'monolith');
});

test('medium → modular-monolith', () => {
  const fw = buildWorkFramework({ tier: 'medium' });
  assertEqual(fw.architecture_type, 'modular-monolith');
});

test('high → microservices', () => {
  const fw = buildWorkFramework({ tier: 'high' });
  assertEqual(fw.architecture_type, 'microservices');
});

test('required_docs always includes PRD.md and Plan.json', () => {
  for (const tier of ['low', 'medium', 'high']) {
    const fw = buildWorkFramework({ tier });
    assert(fw.required_docs.includes('PRD.md'), `${tier}: missing PRD.md`);
    assert(fw.required_docs.includes('Plan.json'), `${tier}: missing Plan.json`);
  }
});

test('high tier has security-scan gate', () => {
  const fw = buildWorkFramework({ tier: 'high' });
  assert(fw.quality_gates.includes('security-scan'));
});

test('low tier has fewer quality gates than high', () => {
  const low = buildWorkFramework({ tier: 'low' });
  const high = buildWorkFramework({ tier: 'high' });
  assert(high.quality_gates.length > low.quality_gates.length);
});

test('suggested_timeline_weeks increases with complexity', () => {
  const l = buildWorkFramework({ tier: 'low' }).suggested_timeline_weeks;
  const m = buildWorkFramework({ tier: 'medium' }).suggested_timeline_weeks;
  const h = buildWorkFramework({ tier: 'high' }).suggested_timeline_weeks;
  assert(l < m && m < h, `expected l<m<h, got ${l}<${m}<${h}`);
});

test('phases array non-empty', () => {
  for (const tier of ['low', 'medium', 'high']) {
    const fw = buildWorkFramework({ tier });
    assert(fw.phases.length >= 4, `${tier}: phases too short`);
  }
});

// ── planProject ───────────────────────────────────────────────────────────────

console.log('\nplanProject');

test('returns plan with all three sections', () => {
  const plan = planProject('A web app with auth and payments');
  assert(plan.complexity, 'missing complexity');
  assert(plan.teamBlueprint, 'missing teamBlueprint');
  assert(plan.workFramework, 'missing workFramework');
});

test('plan_id starts with cto_', () => {
  const plan = planProject('any brief');
  assert(plan.plan_id.startsWith('cto_'));
});

test('created_at is ISO string', () => {
  const plan = planProject('brief');
  assert(!isNaN(Date.parse(plan.created_at)));
});

test('brief_summary is truncated to 500 chars', () => {
  const longBrief = 'x'.repeat(1000);
  const plan = planProject(longBrief);
  assert(plan.brief_summary.length <= 500);
});

test('projectId stored in plan', () => {
  const plan = planProject('brief', { projectId: 'my-project' });
  assertEqual(plan.project_id, 'my-project');
});

test('high complexity brief → large team', () => {
  const plan = planProject('realtime streaming platform with ml recommendations, payments, mobile app and microservices');
  assertEqual(plan.complexity.tier, 'high');
  assert(plan.teamBlueprint.total_headcount >= 8);
});

// ── saveCTOPlan / loadCTOPlan ─────────────────────────────────────────────────

console.log('\nsaveCTOPlan / loadCTOPlan');

let tmpDir;

test('save creates cto-plan.json', () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ogu-cto-'));
  const plan = planProject('test project', { projectId: 'test-proj' });
  saveCTOPlan(tmpDir, 'test-proj', plan);
  assert(existsSync(join(tmpDir, '.ogu', 'projects', 'test-proj', 'cto-plan.json')));
});

test('load returns saved plan', () => {
  const plan = planProject('load test', { projectId: 'load-proj' });
  saveCTOPlan(tmpDir, 'load-proj', plan);
  const loaded = loadCTOPlan(tmpDir, 'load-proj');
  assert(loaded !== null);
  assertEqual(loaded.project_id, 'load-proj');
  assert(loaded.complexity);
  assert(loaded.teamBlueprint);
  assert(loaded.workFramework);
});

test('load returns null for missing project', () => {
  const result = loadCTOPlan(tmpDir, 'nonexistent-project-xyz');
  assert(result === null);
});

test('save creates project directory automatically', () => {
  const plan = planProject('auto dir test', { projectId: 'auto-dir' });
  saveCTOPlan(tmpDir, 'auto-dir', plan);
  assert(existsSync(join(tmpDir, '.ogu', 'projects', 'auto-dir')));
});

// Cleanup
try { if (tmpDir) rmSync(tmpDir, { recursive: true, force: true }); } catch {}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
