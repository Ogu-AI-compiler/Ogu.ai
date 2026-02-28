import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';
import { evaluatePolicy } from './lib/policy-engine.mjs';
import { emitAudit } from './lib/audit-emitter.mjs';

/**
 * ogu governance:check --feature <slug> --task <name> --risk <tier> [--touches <paths>] [--json]
 * ogu approve --feature <slug> --task <name> --role <role> --by <who> [--reason <reason>]
 * ogu deny --feature <slug> --task <name> --role <role> --by <who> [--reason <reason>]
 */

const APPROVALS_DIR = () => join(repoRoot(), '.ogu/approvals');

function parseArgs() {
  const args = process.argv.slice(3);
  const result = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--feature' && args[i + 1]) result.feature = args[++i];
    else if (args[i] === '--task' && args[i + 1]) result.task = args[++i];
    else if (args[i] === '--risk' && args[i + 1]) result.risk = args[++i];
    else if (args[i] === '--touches' && args[i + 1]) result.touches = args[++i].split(',');
    else if (args[i] === '--role' && args[i + 1]) result.role = args[++i];
    else if (args[i] === '--by' && args[i + 1]) result.by = args[++i];
    else if (args[i] === '--reason' && args[i + 1]) result.reason = args[++i];
    else if (args[i] === '--json') result.json = true;
  }
  return result;
}

// ── governance:check ──

export async function governanceCheck() {
  const { feature, task, risk, touches, json } = parseArgs();

  if (!feature || !task) {
    console.error('Usage: ogu governance:check --feature <slug> --task <name> --risk <tier> [--touches <paths>] [--json]');
    return 1;
  }

  // Load feature state if available
  let featureState = 'building';
  const statePath = join(repoRoot(), `.ogu/state/features/${feature}.state.json`);
  if (existsSync(statePath)) {
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    featureState = state.currentState;
  }

  const result = evaluatePolicy({
    featureSlug: feature,
    taskName: task,
    riskTier: risk || 'medium',
    touches: touches || [],
    featureState,
  });

  // Emit audit
  emitAudit('governance.evaluated', {
    feature,
    task,
    riskTier: risk || 'medium',
    decision: result.decision,
    matchedRules: result.matchedRules.length,
    reason: result.reason,
  }, {
    feature: { slug: feature, taskId: task },
  });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const icon = result.decision === 'ALLOW' ? '✓'
      : result.decision === 'DENY' ? '✗'
      : '⚠';
    console.log(`${icon} ${result.decision}: ${result.reason}`);
    if (result.matchedRules.length > 0) {
      console.log(`  Matched rules: ${result.matchedRules.map(r => r.id).join(', ')}`);
    }
  }

  return 0;
}

// ── approve ──

export async function approve() {
  const { feature, task, role, by, reason } = parseArgs();

  if (!feature || !task || !role || !by) {
    console.error('Usage: ogu approve --feature <slug> --task <name> --role <role> --by <who> [--reason <reason>]');
    return 1;
  }

  const dir = APPROVALS_DIR();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const approvalFile = join(dir, `${feature}-${task}.json`);
  let approvals = [];
  if (existsSync(approvalFile)) {
    approvals = JSON.parse(readFileSync(approvalFile, 'utf8'));
  }

  const record = {
    status: 'approved',
    role,
    approvedBy: by,
    reason: reason || '',
    timestamp: new Date().toISOString(),
  };

  approvals.push(record);
  writeFileSync(approvalFile, JSON.stringify(approvals, null, 2), 'utf8');

  emitAudit('approval.granted', {
    feature,
    task,
    role,
    approvedBy: by,
    reason: reason || '',
  }, {
    feature: { slug: feature, taskId: task },
    actor: { type: 'human', id: by, role },
  });

  console.log(`Approved: ${feature}/${task} by ${by} (role: ${role})`);
  return 0;
}

// ── escalate ──

export async function escalate() {
  const { feature, task, role, by, reason } = parseArgs();

  if (!feature || !task || !role) {
    console.error('Usage: ogu escalate --feature <slug> --task <name> --role <role> [--by <who>] [--reason <reason>]');
    return 1;
  }

  const dir = APPROVALS_DIR();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const approvalFile = join(dir, `${feature}-${task}.json`);
  let approvals = [];
  if (existsSync(approvalFile)) {
    approvals = JSON.parse(readFileSync(approvalFile, 'utf8'));
  }

  // Load OrgSpec to find escalation target
  const orgPath = join(repoRoot(), '.ogu/OrgSpec.json');
  let escalationTarget = null;
  if (existsSync(orgPath)) {
    const org = JSON.parse(readFileSync(orgPath, 'utf8'));
    const roleObj = org.roles.find(r => r.roleId === role);
    const esc = roleObj?.escalationPath;
    escalationTarget = Array.isArray(esc) ? esc[0] : esc;
  }

  const record = {
    status: 'escalated',
    role,
    escalatedBy: by || 'system',
    escalatedTo: escalationTarget || 'tech-lead',
    reason: reason || 'Escalation requested',
    timestamp: new Date().toISOString(),
  };

  approvals.push(record);
  writeFileSync(approvalFile, JSON.stringify(approvals, null, 2), 'utf8');

  emitAudit('approval.escalated', {
    feature,
    task,
    role,
    escalatedTo: escalationTarget || 'tech-lead',
    reason: reason || 'Escalation requested',
  }, {
    feature: { slug: feature, taskId: task },
    severity: 'warn',
  });

  console.log(`Escalated: ${feature}/${task} from ${role} → ${escalationTarget || 'tech-lead'}`);
  return 0;
}

// ── deny ──

export async function deny() {
  const { feature, task, role, by, reason } = parseArgs();

  if (!feature || !task || !role || !by) {
    console.error('Usage: ogu deny --feature <slug> --task <name> --role <role> --by <who> [--reason <reason>]');
    return 1;
  }

  const dir = APPROVALS_DIR();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const approvalFile = join(dir, `${feature}-${task}.json`);
  let approvals = [];
  if (existsSync(approvalFile)) {
    approvals = JSON.parse(readFileSync(approvalFile, 'utf8'));
  }

  const record = {
    status: 'denied',
    role,
    deniedBy: by,
    reason: reason || 'No reason provided',
    timestamp: new Date().toISOString(),
  };

  approvals.push(record);
  writeFileSync(approvalFile, JSON.stringify(approvals, null, 2), 'utf8');

  emitAudit('approval.denied', {
    feature,
    task,
    role,
    deniedBy: by,
    reason: reason || 'No reason provided',
  }, {
    feature: { slug: feature, taskId: task },
    actor: { type: 'human', id: by, role },
  });

  console.log(`Denied: ${feature}/${task} by ${by} (reason: ${reason || 'No reason provided'})`);
  return 0;
}
