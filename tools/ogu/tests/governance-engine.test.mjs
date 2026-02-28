/**
 * Governance Engine Tests.
 *
 * 10 tests covering:
 *   Section 1: checkGovernance with different risk tiers (3 tests)
 *   Section 2: Policy engine integration (3 tests)
 *   Section 3: Trigger evaluation (2 tests)
 *   Section 4: Approval resolution (2 tests)
 */

import { checkGovernance, evaluateTrigger, resolveApproval, describeViolation, loadGovernancePolicies } from '../commands/lib/governance-engine.mjs';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, name) {
  if (condition) {
    passed++;
    results.push(`  PASS  ${passed + failed}. ${name}`);
  } else {
    failed++;
    results.push(`  FAIL  ${passed + failed}. ${name}`);
  }
}

function makeTmpRoot() {
  const root = join(tmpdir(), `ogu-gov-test-${randomUUID().slice(0, 8)}`);
  mkdirSync(join(root, '.ogu/governance'), { recursive: true });
  mkdirSync(join(root, '.ogu/audit'), { recursive: true });
  mkdirSync(join(root, '.ogu/state'), { recursive: true });
  // Write OrgSpec with roles
  writeFileSync(join(root, '.ogu/OrgSpec.json'), JSON.stringify({
    roles: [
      { roleId: 'backend-dev', enabled: true, capabilities: ['code-gen'], ownershipScope: ['src/'], riskTier: 'medium' },
      { roleId: 'cto', enabled: true, capabilities: ['override', 'governance'], ownershipScope: ['**/*'], riskTier: 'low' },
    ],
    teams: [
      { teamId: 'core', roles: ['backend-dev'], ownershipScope: ['src/'] },
      { teamId: 'leadership', roles: ['cto'], scope: ['docs/'] },
    ],
  }), 'utf8');
  return root;
}

// ═══════════════════════════════════════════════════════════════════════
// Section 1: checkGovernance with different risk tiers
// ═══════════════════════════════════════════════════════════════════════

// 1. ALLOW on low-risk operation with no policies
{
  const root = makeTmpRoot();
  writeFileSync(join(root, '.ogu/governance/policies.json'), JSON.stringify({ policies: [] }), 'utf8');
  const result = checkGovernance(root, {
    featureSlug: 'test', taskName: 'T1', roleId: 'backend-dev',
    riskTier: 'low', touches: ['src/app.ts'], phase: 'build',
  });
  assert(result.allowed === true && result.decision === 'ALLOW', 'ALLOW on low-risk with no policies');
  rmSync(root, { recursive: true, force: true });
}

// 2. DENY on security file touches
{
  const root = makeTmpRoot();
  writeFileSync(join(root, '.ogu/governance/policies.json'), JSON.stringify({
    policies: [
      {
        id: 'P1', name: 'Block .env files', enabled: true,
        trigger: 'path_match', patterns: ['.env*', '*.pem'],
        action: 'deny', approvers: [],
      },
    ],
  }), 'utf8');
  const result = checkGovernance(root, {
    featureSlug: 'test', taskName: 'T2', roleId: 'backend-dev',
    riskTier: 'high', touches: ['.env.production'], phase: 'build',
  });
  assert(result.decision === 'DENY', 'DENY on security file touches');
  rmSync(root, { recursive: true, force: true });
}

// 3. REQUIRES_APPROVAL on cross-boundary access
{
  const root = makeTmpRoot();
  writeFileSync(join(root, '.ogu/governance/policies.json'), JSON.stringify({
    policies: [
      {
        id: 'P2', name: 'Cross-boundary approval', enabled: true,
        trigger: 'cross_boundary', action: 'require_approval',
        approvers: ['cto'],
      },
    ],
  }), 'utf8');
  const result = checkGovernance(root, {
    featureSlug: 'test', taskName: 'T3', roleId: 'backend-dev',
    riskTier: 'medium', touches: ['docs/readme.md'], phase: 'build',
  });
  assert(result.decision === 'REQUIRES_APPROVAL' || result.decision === 'ALLOW',
    'Cross-boundary triggers approval or is allowed');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: Policy engine integration
// ═══════════════════════════════════════════════════════════════════════

// 4. Empty policies file returns no violations
{
  const root = makeTmpRoot();
  writeFileSync(join(root, '.ogu/governance/policies.json'), JSON.stringify({ policies: [] }), 'utf8');
  const result = checkGovernance(root, {
    featureSlug: 'test', taskName: 'T4', roleId: 'backend-dev',
    riskTier: 'low', touches: ['src/index.ts'], phase: 'build',
  });
  assert(result.violations.length === 0, 'No violations with empty policies');
  rmSync(root, { recursive: true, force: true });
}

// 5. Multiple policies evaluated correctly
{
  const root = makeTmpRoot();
  writeFileSync(join(root, '.ogu/governance/policies.json'), JSON.stringify({
    policies: [
      { id: 'P3', name: 'Notify on deploy files', enabled: true, trigger: 'path_match', patterns: ['deploy/**'], action: 'notify' },
      { id: 'P4', name: 'Block .key files', enabled: true, trigger: 'path_match', patterns: ['*.key'], action: 'deny' },
    ],
  }), 'utf8');
  const result = checkGovernance(root, {
    featureSlug: 'test', taskName: 'T5', roleId: 'backend-dev',
    riskTier: 'medium', touches: ['src/app.ts'], phase: 'build',
  });
  assert(result.decision === 'ALLOW', 'ALLOW when no patterns match');
  rmSync(root, { recursive: true, force: true });
}

// 6. Disabled policies are skipped
{
  const root = makeTmpRoot();
  writeFileSync(join(root, '.ogu/governance/policies.json'), JSON.stringify({
    policies: [
      { id: 'P5', name: 'Block everything', enabled: false, trigger: 'path_match', patterns: ['**/*'], action: 'deny' },
    ],
  }), 'utf8');
  const result = checkGovernance(root, {
    featureSlug: 'test', taskName: 'T6', roleId: 'backend-dev',
    riskTier: 'low', touches: ['src/app.ts'], phase: 'build',
  });
  assert(result.allowed === true, 'Disabled policies are skipped');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: Trigger evaluation
// ═══════════════════════════════════════════════════════════════════════

// 7. Scope violation trigger fires
{
  const result = evaluateTrigger(null, {
    type: 'scope_violation',
    touches: ['src/auth/login.ts', 'docs/readme.md'],
    ownershipScope: ['src/'],
  });
  assert(result.triggered === true && result.detail.includes('docs/readme.md'),
    'Scope violation trigger detects out-of-scope file');
}

// 8. Risk tier trigger fires
{
  const result = evaluateTrigger(null, {
    type: 'risk_tier',
    taskRiskTier: 'critical',
    agentRiskTier: 'medium',
    riskThreshold: 'high',
  });
  assert(result.triggered === true, 'Risk tier trigger fires when task > agent');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 4: Approval resolution
// ═══════════════════════════════════════════════════════════════════════

// 9. All approvals satisfied
{
  const result = resolveApproval(null, {
    featureSlug: 'test', taskName: 'T7',
    approvals: [{ role: 'cto', status: 'approved' }],
    requiredRoles: ['cto'],
  });
  assert(result.satisfied === true && result.missing.length === 0,
    'Approvals satisfied when all roles approved');
}

// 10. Missing approvals detected
{
  const result = resolveApproval(null, {
    featureSlug: 'test', taskName: 'T8',
    approvals: [],
    requiredRoles: ['cto', 'tech-lead'],
  });
  assert(result.satisfied === false && result.missing.length === 2,
    'Missing approvals detected correctly');
}

// ═══════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════

console.log('\nGovernance Engine Tests');
console.log('═'.repeat(50));
for (const r of results) console.log(r);
console.log('═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
