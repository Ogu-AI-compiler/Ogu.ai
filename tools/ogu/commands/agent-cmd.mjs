import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadOrgSpec, matchRole, loadAgentState } from './lib/agent-registry.mjs';
import { repoRoot } from '../util.mjs';
import { emitAudit } from './lib/audit-emitter.mjs';

/**
 * ogu agent:list [--with-state]       — List all registered roles/agents
 * ogu agent:show <roleId>             — Show role details + agent state
 * ogu agent:create <roleId> [opts]    — Create new agent role in OrgSpec
 */

export async function agentList() {
  const org = loadOrgSpec();
  if (!org) {
    console.error('OrgSpec.json not found. Run: ogu org:init');
    return 1;
  }

  const withState = process.argv.includes('--with-state');

  console.log(`\n  Agents: ${org.roles.length} roles\n`);

  if (withState) {
    console.log('  ROLE            MODEL    TOKENS TODAY   COST      TASKS   FAILURES');
    for (const role of org.roles) {
      const state = loadAgentState(role.roleId);
      const model = role.modelPolicy?.default || 'sonnet';
      const tokens = (state.tokensUsedToday || state.tokensUsed || 0).toLocaleString();
      const cost = `$${(state.costToday || state.costUsed || 0).toFixed(2)}`;
      const tasks = state.tasksCompleted || 0;
      const fails = state.tasksFailed || 0;
      console.log(`  ${role.roleId.padEnd(16)} ${model.padEnd(8)} ${tokens.padStart(12)}   ${cost.padStart(8)}   ${String(tasks).padStart(5)}   ${String(fails).padStart(5)}`);
    }
  } else {
    for (const role of org.roles) {
      const status = role.enabled !== false ? 'active' : 'disabled';
      const state = loadAgentState(role.roleId);
      const active = state.currentTask ? ` [working: ${state.currentTask}]` : '';
      const stats = state.tasksCompleted > 0
        ? ` (${state.tasksCompleted} done, ${state.tasksFailed} failed)`
        : '';
      const model = role.modelPolicy?.default || '—';
      const phases = role.phases ? role.phases.join(',') : '—';

      console.log(`  ${role.roleId.padEnd(16)} ${role.department.padEnd(14)} ${status}${active}${stats}`);
      console.log(`    ${role.name} — ${role.capabilities.join(', ')}`);
      console.log(`    Model: ${model} | Phases: ${phases} | Risk: ${role.riskTier}`);
    }
  }

  return 0;
}

export async function agentShow() {
  const roleId = process.argv[3];
  if (!roleId) {
    console.error('Usage: ogu agent:show <roleId>');
    return 1;
  }

  const role = matchRole({ roleId });
  if (!role) {
    console.error(`Role "${roleId}" not found.`);
    return 1;
  }

  const state = loadAgentState(roleId);

  console.log(`\n  Agent: ${role.name} (${role.roleId})`);
  console.log(`  Department: ${role.department}`);
  console.log(`  Risk tier: ${role.riskTier}`);
  console.log(`  Capabilities: ${role.capabilities.join(', ')}`);

  if (role.phases) {
    console.log(`  Phases: ${role.phases.join(', ')}`);
  }
  if (role.sourceSkill) {
    console.log(`  Source skill: ${role.sourceSkill}`);
  }

  // Model policy
  if (role.modelPolicy) {
    console.log(`  Model policy:`);
    console.log(`    Default: ${role.modelPolicy.default}`);
    console.log(`    Max tier: ${role.modelPolicy.maxTier}`);
    console.log(`    Escalation: ${role.modelPolicy.escalationEnabled ? role.modelPolicy.escalationChain.join(' → ') : 'disabled'}`);
  }

  // Budget quota
  if (role.budgetQuota) {
    console.log(`  Budget:`);
    console.log(`    Daily tokens: ${role.budgetQuota.dailyTokens.toLocaleString()}`);
    console.log(`    Max cost/task: $${role.budgetQuota.maxCostPerTask}`);
  }

  // Ownership & commands
  if (role.ownershipScope) {
    console.log(`  Ownership: ${role.ownershipScope.join(', ')}`);
  }
  if (role.allowedCommands) {
    console.log(`  Allowed commands: ${role.allowedCommands.join(', ')}`);
  }
  if (role.blockedCommands && role.blockedCommands.length > 0) {
    console.log(`  Blocked commands: ${role.blockedCommands.join(', ')}`);
  }

  // Memory scope
  if (role.memoryScope) {
    console.log(`  Memory scope:`);
    console.log(`    Read: ${role.memoryScope.read.join(', ')}`);
    console.log(`    Write: ${role.memoryScope.write.length > 0 ? role.memoryScope.write.join(', ') : 'none'}`);
  }

  // Escalation
  const esc = role.escalationPath;
  const escStr = Array.isArray(esc) ? esc.join(' → ') : (esc || 'none');
  console.log(`  Escalation: ${escStr}`);

  console.log(`  Can approve: ${role.canApprove ? 'yes' : 'no'}`);
  console.log(`  Enabled: ${role.enabled !== false ? 'yes' : 'no'}`);

  if (role.sandbox) {
    console.log(`  Sandbox:`);
    if (role.sandbox.allowedPaths) console.log(`    Allowed: ${role.sandbox.allowedPaths.join(', ')}`);
    if (role.sandbox.blockedPaths) console.log(`    Blocked: ${role.sandbox.blockedPaths.join(', ')}`);
    console.log(`    Network: ${role.sandbox.networkAccess || 'none'}`);
    console.log(`    Concurrency: ${role.sandbox.maxConcurrency || 1}`);
  }

  console.log('');
  console.log('  State:');
  console.log(`    Tasks completed: ${state.tasksCompleted}`);
  console.log(`    Tasks failed: ${state.tasksFailed}`);
  console.log(`    Tokens used: ${(state.tokensUsed || 0).toLocaleString()}`);
  console.log(`    Cost: $${(state.costUsed || 0).toFixed(4)}`);
  console.log(`    Last active: ${state.lastActiveAt || 'never'}`);
  console.log(`    Current task: ${state.currentTask || 'none'}`);

  return 0;
}

/**
 * ogu agent:create <roleId> --name <name> --dept <department> --capabilities <cap1,cap2>
 *   [--risk <low|medium|high>] [--model <default-model>] [--phases <p1,p2>]
 */
export async function agentCreate() {
  const args = process.argv.slice(3);
  const roleId = args[0];
  if (!roleId || roleId.startsWith('--')) {
    console.error('Usage: ogu agent:create <roleId> --name <name> --dept <department> --capabilities <cap1,cap2>');
    return 1;
  }

  // Parse flags
  let name = roleId, dept = 'engineering', capabilities = ['code_generation'];
  let risk = 'medium', model = 'sonnet', phases = ['build'];
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) name = args[++i];
    else if (args[i] === '--dept' && args[i + 1]) dept = args[++i];
    else if (args[i] === '--capabilities' && args[i + 1]) capabilities = args[++i].split(',');
    else if (args[i] === '--risk' && args[i + 1]) risk = args[++i];
    else if (args[i] === '--model' && args[i + 1]) model = args[++i];
    else if (args[i] === '--phases' && args[i + 1]) phases = args[++i].split(',');
  }

  const root = repoRoot();
  const orgPath = join(root, '.ogu/OrgSpec.json');
  if (!existsSync(orgPath)) {
    console.error('OrgSpec.json not found. Run: ogu org:init');
    return 1;
  }

  const orgSpec = JSON.parse(readFileSync(orgPath, 'utf8'));

  // Check duplicate
  if (orgSpec.roles.find(r => r.roleId === roleId)) {
    console.error(`Role "${roleId}" already exists.`);
    return 1;
  }

  const newRole = {
    roleId,
    name,
    department: dept,
    capabilities,
    riskTier: risk,
    modelPolicy: {
      default: model,
      maxTier: model === 'opus' ? 'opus' : model === 'sonnet' ? 'opus' : 'sonnet',
      escalationEnabled: true,
      escalationChain: ['haiku', 'sonnet', 'opus'],
    },
    budgetQuota: { dailyTokens: 1000000, maxCostPerTask: 5.00, currency: 'USD' },
    ownershipScope: [],
    allowedCommands: [],
    blockedCommands: [],
    escalationPath: ['tech-lead', 'cto'],
    memoryScope: { read: ['.ogu/MEMORY.md'], write: [] },
    phases,
    enabled: true,
    canApprove: false,
    sandbox: {
      allowedPaths: ['src/**', 'lib/**'],
      blockedPaths: ['.env*', '**/credentials*'],
      networkAccess: 'none',
      maxConcurrency: 1,
    },
  };

  orgSpec.roles.push(newRole);
  writeFileSync(orgPath, JSON.stringify(orgSpec, null, 2), 'utf8');

  emitAudit('agent.created', { roleId, name, dept, capabilities, risk }, {});

  console.log(`\n  Created agent: ${roleId}`);
  console.log(`    Name: ${name}`);
  console.log(`    Department: ${dept}`);
  console.log(`    Capabilities: ${capabilities.join(', ')}`);
  console.log(`    Risk: ${risk}`);
  console.log(`    Model: ${model}`);
  console.log(`    Phases: ${phases.join(', ')}`);
  console.log('');
  return 0;
}
