import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { repoRoot } from '../util.mjs';
import { emitAudit } from './lib/audit-emitter.mjs';
import { loadBudget } from './lib/budget-tracker.mjs';
import { validateOrgSpec } from './lib/agent-registry.mjs';
import { seedOrgSpec } from './lib/orgspec-seeder.mjs';

/**
 * ogu org:init [--force] [--from-skills]
 * ogu org:show
 * ogu org:validate
 */

const ORGSPEC_PATH = () => join(repoRoot(), '.ogu/OrgSpec.json');

// ── Role → Skill Mapping ──

const SKILL_ROLE_MAP = {
  'idea':       { roleId: 'pm', phases: ['idea'] },
  'feature':    { roleId: 'pm', phases: ['feature'] },
  'architect':  { roleId: 'architect', phases: ['architect'] },
  'design':     { roleId: 'designer', phases: ['design'] },
  'build':      { roleId: 'backend-dev', phases: ['build'] },
  'smoke':      { roleId: 'qa', phases: ['verify'] },
  'verify-ui':  { roleId: 'qa', phases: ['verify'] },
  'vision':     { roleId: 'qa', phases: ['verify'] },
  'enforce':    { roleId: 'security', phases: ['enforce'] },
  'preview':    { roleId: 'devops', phases: ['preview'] },
  'observe':    { roleId: 'devops', phases: ['observe'] },
  'done':       { roleId: 'tech-lead', phases: ['done'] },
  'pipeline':   { roleId: 'tech-lead', phases: ['pipeline'] },
  'reference':  { roleId: 'designer', phases: ['design'] },
  'brand-scan': { roleId: 'designer', phases: ['design'] },
};

// ── Full OrgSpec with per-role config ──

function createFullOrgSpec(skillCount) {
  return {
    version: 1,
    name: 'My Company',
    description: 'Agentic Company OS',
    updatedAt: new Date().toISOString(),
    roles: [
      {
        roleId: 'pm',
        name: 'Product Manager',
        description: 'Defines product requirements and specifications.',
        department: 'product',
        capabilities: ['documentation', 'review'],
        riskTier: 'low',
        modelPolicy: { default: 'sonnet', maxTier: 'sonnet', escalationEnabled: false, escalationThreshold: 3, escalationChain: ['haiku', 'sonnet'] },
        budgetQuota: { dailyTokens: 500000, maxCostPerTask: 2.00, currency: 'USD' },
        ownershipScope: ['docs/vault/04_Features/*/PRD.md', 'docs/vault/04_Features/*/QA.md'],
        allowedCommands: ['feature:create', 'feature:validate'],
        blockedCommands: ['compile', 'gates'],
        memoryScope: { read: ['docs/vault/04_Features/*', '.ogu/MEMORY.md'], write: ['docs/vault/04_Features/*/PRD.md'] },
        phases: ['idea', 'feature'],
        sourceSkill: 'feature',
        escalationPath: ['tech-lead', 'cto'],
        sandbox: { allowedPaths: ['docs/**'], blockedPaths: ['src/**', '.env'], networkAccess: 'none', maxConcurrency: 1 },
        maxTokensPerTask: 50000,
        canApprove: true,
        enabled: true,
      },
      {
        roleId: 'architect',
        name: 'Architect',
        description: 'System architect. Designs structure, contracts, ADRs.',
        department: 'engineering',
        capabilities: ['architecture', 'code_generation', 'review'],
        riskTier: 'medium',
        modelPolicy: { default: 'opus', maxTier: 'opus', escalationEnabled: false, escalationThreshold: 3, escalationChain: ['opus'] },
        budgetQuota: { dailyTokens: 2000000, maxCostPerTask: 10.00, currency: 'USD' },
        ownershipScope: ['docs/vault/01_Architecture/**', 'docs/vault/02_Contracts/**'],
        allowedCommands: ['architect', 'graph', 'impact', 'adr'],
        blockedCommands: [],
        memoryScope: { read: ['docs/vault/**', '.ogu/MEMORY.md'], write: ['docs/vault/01_Architecture/**'] },
        phases: ['architect'],
        sourceSkill: 'architect',
        escalationPath: ['tech-lead'],
        sandbox: { allowedPaths: ['docs/**', 'src/**'], blockedPaths: ['.env'], networkAccess: 'none', maxConcurrency: 1 },
        maxTokensPerTask: 200000,
        canApprove: true,
        enabled: true,
      },
      {
        roleId: 'designer',
        name: 'Designer',
        description: 'UI/UX designer. Creates design variants, themes, brand assets.',
        department: 'design',
        capabilities: ['design', 'documentation'],
        riskTier: 'low',
        modelPolicy: { default: 'sonnet', maxTier: 'sonnet', escalationEnabled: false, escalationThreshold: 3, escalationChain: ['sonnet'] },
        budgetQuota: { dailyTokens: 500000, maxCostPerTask: 2.00, currency: 'USD' },
        ownershipScope: ['docs/vault/05_Design/**'],
        allowedCommands: ['design:show', 'design:pick', 'theme', 'brand-scan', 'reference'],
        blockedCommands: ['compile', 'gates'],
        memoryScope: { read: ['docs/vault/05_Design/**'], write: ['docs/vault/05_Design/**'] },
        phases: ['design'],
        sourceSkill: 'design',
        escalationPath: ['pm'],
        sandbox: { allowedPaths: ['docs/**', 'public/**', 'src/styles/**'], blockedPaths: ['.env'], networkAccess: 'none', maxConcurrency: 2 },
        maxTokensPerTask: 60000,
        canApprove: false,
        enabled: true,
      },
      {
        roleId: 'backend-dev',
        name: 'Backend Developer',
        description: 'Backend specialist. Builds APIs, services, database logic.',
        department: 'engineering',
        capabilities: ['code_generation', 'testing', 'documentation'],
        riskTier: 'medium',
        modelPolicy: { default: 'sonnet', maxTier: 'opus', escalationEnabled: true, escalationThreshold: 3, escalationChain: ['haiku', 'sonnet', 'opus'] },
        budgetQuota: { dailyTokens: 1000000, maxCostPerTask: 5.00, currency: 'USD' },
        ownershipScope: ['server/**', 'api/**', 'lib/**'],
        allowedCommands: ['build', 'compile:run'],
        blockedCommands: [],
        memoryScope: { read: ['docs/vault/**'], write: [] },
        phases: ['build'],
        sourceSkill: 'build',
        escalationPath: ['tech-lead'],
        sandbox: { allowedPaths: ['server/**', 'api/**', 'lib/**', 'tests/**'], blockedPaths: ['.env', '.ogu/**'], networkAccess: 'internal', maxConcurrency: 2 },
        maxTokensPerTask: 100000,
        canApprove: false,
        enabled: true,
      },
      {
        roleId: 'frontend-dev',
        name: 'Frontend Developer',
        description: 'Frontend specialist. Builds UI components, pages, client-side logic.',
        department: 'engineering',
        capabilities: ['code_generation', 'testing', 'design'],
        riskTier: 'medium',
        modelPolicy: { default: 'sonnet', maxTier: 'opus', escalationEnabled: true, escalationThreshold: 3, escalationChain: ['haiku', 'sonnet', 'opus'] },
        budgetQuota: { dailyTokens: 1000000, maxCostPerTask: 5.00, currency: 'USD' },
        ownershipScope: ['src/components/**', 'src/pages/**', 'public/**'],
        allowedCommands: ['build', 'compile:run'],
        blockedCommands: [],
        memoryScope: { read: ['docs/vault/**'], write: [] },
        phases: ['build'],
        sourceSkill: 'build',
        escalationPath: ['tech-lead'],
        sandbox: { allowedPaths: ['src/**', 'public/**', 'tests/**'], blockedPaths: ['.env', '.ogu/**', 'server/**'], networkAccess: 'none', maxConcurrency: 2 },
        maxTokensPerTask: 100000,
        canApprove: false,
        enabled: true,
      },
      {
        roleId: 'qa',
        name: 'QA Engineer',
        description: 'Quality assurance. Writes and runs tests, validates gates.',
        department: 'testing',
        capabilities: ['testing', 'review', 'documentation'],
        riskTier: 'medium',
        modelPolicy: { default: 'sonnet', maxTier: 'opus', escalationEnabled: true, escalationThreshold: 3, escalationChain: ['haiku', 'sonnet', 'opus'] },
        budgetQuota: { dailyTokens: 1000000, maxCostPerTask: 5.00, currency: 'USD' },
        ownershipScope: ['tests/**'],
        allowedCommands: ['smoke', 'verify-ui', 'vision', 'gates'],
        blockedCommands: [],
        memoryScope: { read: ['docs/vault/**', 'tests/**'], write: ['tests/**'] },
        phases: ['verify'],
        sourceSkill: 'smoke',
        escalationPath: ['tech-lead'],
        sandbox: { allowedPaths: ['tests/**', 'src/**', 'docs/**'], blockedPaths: ['.env'], networkAccess: 'none', maxConcurrency: 3 },
        maxTokensPerTask: 80000,
        canApprove: false,
        enabled: true,
      },
      {
        roleId: 'security',
        name: 'Security Auditor',
        description: 'Security audit. Scans code for vulnerabilities.',
        department: 'security',
        capabilities: ['security_audit', 'review'],
        riskTier: 'high',
        modelPolicy: { default: 'opus', maxTier: 'opus', escalationEnabled: false, escalationThreshold: 3, escalationChain: ['opus'] },
        budgetQuota: { dailyTokens: 500000, maxCostPerTask: 5.00, currency: 'USD' },
        ownershipScope: ['docs/vault/02_Contracts/**'],
        allowedCommands: ['enforce', 'contracts:validate'],
        blockedCommands: ['build', 'compile'],
        memoryScope: { read: ['**'], write: [] },
        phases: ['enforce'],
        sourceSkill: 'enforce',
        escalationPath: ['tech-lead'],
        sandbox: { allowedPaths: ['src/**', 'docs/**'], blockedPaths: ['.env'], networkAccess: 'none', maxConcurrency: 1 },
        maxTokensPerTask: 150000,
        canApprove: true,
        enabled: true,
      },
      {
        roleId: 'devops',
        name: 'DevOps Engineer',
        description: 'DevOps. Manages CI/CD, deployment, infrastructure.',
        department: 'devops',
        capabilities: ['code_generation', 'documentation'],
        riskTier: 'high',
        modelPolicy: { default: 'opus', maxTier: 'opus', escalationEnabled: false, escalationThreshold: 3, escalationChain: ['sonnet', 'opus'] },
        budgetQuota: { dailyTokens: 500000, maxCostPerTask: 5.00, currency: 'USD' },
        ownershipScope: ['.github/**', 'docker/**', 'infra/**'],
        allowedCommands: ['preview', 'observe', 'observe:setup'],
        blockedCommands: [],
        memoryScope: { read: ['.ogu/MEMORY.md'], write: [] },
        phases: ['preview', 'observe'],
        sourceSkill: 'preview',
        escalationPath: ['tech-lead'],
        sandbox: { allowedPaths: ['.github/**', 'docker/**', 'infra/**', 'scripts/**'], blockedPaths: ['.env', 'src/**'], networkAccess: 'internal', maxConcurrency: 1 },
        maxTokensPerTask: 80000,
        canApprove: false,
        enabled: true,
      },
      {
        roleId: 'tech-lead',
        name: 'Tech Lead',
        description: 'Technical lead. Reviews cross-boundary changes, approves escalations.',
        department: 'engineering',
        capabilities: ['architecture', 'code_generation', 'review', 'testing'],
        riskTier: 'high',
        modelPolicy: { default: 'opus', maxTier: 'opus', escalationEnabled: false, escalationThreshold: 3, escalationChain: ['opus'] },
        budgetQuota: { dailyTokens: 3000000, maxCostPerTask: 15.00, currency: 'USD' },
        ownershipScope: ['**'],
        allowedCommands: ['compile', 'gates', 'done', 'pipeline'],
        blockedCommands: [],
        memoryScope: { read: ['**'], write: ['**'] },
        phases: ['done', 'pipeline'],
        sourceSkill: 'done',
        escalationPath: ['cto'],
        sandbox: { allowedPaths: ['**'], blockedPaths: ['.env'], networkAccess: 'internal', maxConcurrency: 1 },
        maxTokensPerTask: 300000,
        canApprove: true,
        enabled: true,
      },
      {
        roleId: 'cto',
        name: 'CTO',
        description: 'Escalation target. Final authority on architecture and governance.',
        department: 'engineering',
        capabilities: ['architecture', 'code_generation', 'review', 'testing', 'security_audit'],
        riskTier: 'critical',
        modelPolicy: { default: 'opus', maxTier: 'opus', escalationEnabled: false, escalationThreshold: 3, escalationChain: ['opus'] },
        budgetQuota: { dailyTokens: 5000000, maxCostPerTask: 25.00, currency: 'USD' },
        ownershipScope: ['**'],
        allowedCommands: ['**'],
        blockedCommands: [],
        memoryScope: { read: ['**'], write: ['**'] },
        phases: ['governance'],
        sourceSkill: null,
        escalationPath: [],
        sandbox: { allowedPaths: ['**'], blockedPaths: [], networkAccess: 'full', maxConcurrency: 1 },
        maxTokensPerTask: 500000,
        canApprove: true,
        enabled: true,
      },
    ],
    teams: [
      { teamId: 'product', name: 'Product Team', lead: 'pm', roles: ['pm', 'designer'], features: [] },
      { teamId: 'engineering', name: 'Engineering Team', lead: 'architect', roles: ['architect', 'backend-dev', 'frontend-dev', 'devops'], features: [] },
      { teamId: 'quality', name: 'Quality Team', lead: 'qa', roles: ['qa', 'security'], features: [] },
    ],
    providers: [
      {
        id: 'anthropic',
        name: 'Anthropic',
        type: 'anthropic',
        models: [
          { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', capabilities: ['code_generation', 'testing', 'documentation'], costPer1kInput: 0.001, costPer1kOutput: 0.005, maxTokens: 200000, tier: 'fast' },
          { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', capabilities: ['code_generation', 'testing', 'documentation', 'review'], costPer1kInput: 0.003, costPer1kOutput: 0.015, maxTokens: 200000, tier: 'standard' },
          { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', capabilities: ['code_generation', 'testing', 'documentation', 'review', 'architecture', 'security_audit'], costPer1kInput: 0.015, costPer1kOutput: 0.075, maxTokens: 200000, tier: 'premium' },
        ],
        enabled: true,
      },
      { id: 'openai', name: 'OpenAI', type: 'openai', models: [], enabled: false },
    ],
    budget: { dailyLimit: 50, monthlyLimit: 1000, currency: 'USD', alertThreshold: 0.8, alertThresholds: [0.50, 0.75, 0.90] },
    capabilities: [
      { id: 'code_generation', name: 'Code Generation' },
      { id: 'testing', name: 'Testing & QA' },
      { id: 'documentation', name: 'Documentation' },
      { id: 'review', name: 'Code Review' },
      { id: 'architecture', name: 'Architecture Design' },
      { id: 'security_audit', name: 'Security Audit' },
      { id: 'design', name: 'UI/UX Design' },
    ],
    governance: {
      requireApprovalForCrossBoundary: true,
      requireApprovalForSecurity: true,
      autoTransitionsEnabled: false,
      maxConcurrentFeatures: 5,
    },
    defaults: {
      modelPolicy: { default: 'sonnet', maxTier: 'opus', escalationEnabled: true, escalationThreshold: 3, escalationChain: ['haiku', 'sonnet', 'opus'] },
      budgetQuota: { dailyTokens: 1000000, maxCostPerTask: 5.00, currency: 'USD' },
      riskTier: 'medium',
    },
  };
}

// ── Commands ──

export async function orgInit() {
  const root = repoRoot();
  const orgPath = ORGSPEC_PATH();

  const forceFlag = process.argv.includes('--force');
  const fromSkills = process.argv.includes('--from-skills');

  if (existsSync(orgPath) && !forceFlag) {
    console.log('OrgSpec.json already exists. Use org:validate to check it, or --force to overwrite.');
    return 0;
  }

  // Ensure directories exist
  const dirs = ['.ogu/state/features', '.ogu/agents', '.ogu/audit', '.ogu/budget', '.ogu/runners'];
  for (const dir of dirs) {
    mkdirSync(join(root, dir), { recursive: true });
  }

  // Use seeder to generate base spec (Phase 3E), then overlay with full spec
  const seededSpec = seedOrgSpec();
  const orgSpec = createFullOrgSpec();
  // Attach seeded metadata
  orgSpec._seeded = { version: seededSpec.version, rolesSeeded: seededSpec.roles.length, createdAt: seededSpec.createdAt };

  // If --from-skills, scan existing skills and report
  let skillCount = 0;
  if (fromSkills) {
    const skillDir = join(root, '.claude/skills');
    if (existsSync(skillDir)) {
      const files = readdirSync(skillDir).filter(f => f.endsWith('.md'));
      skillCount = files.length;
      // Map skills to roles
      const mappedRoles = new Set();
      for (const file of files) {
        const skillName = basename(file, '.md').replace(/^\d+-/, '');
        const mapping = SKILL_ROLE_MAP[skillName];
        if (mapping) mappedRoles.add(mapping.roleId);
      }
      console.log(`Scanned ${skillCount} skills → ${mappedRoles.size} roles mapped`);
    }
  }

  writeFileSync(orgPath, JSON.stringify(orgSpec, null, 2), 'utf8');

  // Initialize budget state
  loadBudget(orgSpec.budget);

  // Emit audit
  emitAudit('org.initialized', {
    roles: orgSpec.roles.length,
    teams: orgSpec.teams.length,
    providers: orgSpec.providers.length,
    budget: orgSpec.budget,
    fromSkills,
  });

  console.log('OrgSpec initialized:');
  console.log(`  Roles:     ${orgSpec.roles.length} (${orgSpec.roles.map(r => r.roleId).join(', ')})`);
  console.log(`  Teams:     ${orgSpec.teams.length} (${orgSpec.teams.map(t => t.name).join(', ')})`);
  console.log(`  Providers: ${orgSpec.providers.length} (${orgSpec.providers.map(p => p.name).join(', ')})`);
  console.log(`  Budget:    $${orgSpec.budget.dailyLimit}/day, $${orgSpec.budget.monthlyLimit}/month`);
  console.log(`  Path:      .ogu/OrgSpec.json`);
  return 0;
}

export async function orgShow() {
  const orgPath = ORGSPEC_PATH();
  if (!existsSync(orgPath)) {
    console.error('OrgSpec.json not found. Run: ogu org:init');
    return 1;
  }

  const org = JSON.parse(readFileSync(orgPath, 'utf8'));
  console.log(`Organization: ${org.name} (v${org.version})`);
  console.log('');

  // Group by team
  if (org.teams && org.teams.length > 0) {
    for (const team of org.teams) {
      console.log(`┌─ ${team.name} (lead: ${team.lead})`);
      for (const roleId of team.roles) {
        const role = org.roles.find(r => r.roleId === roleId);
        if (!role) continue;
        const model = role.modelPolicy?.default || 'sonnet';
        const tokens = role.budgetQuota ? `${(role.budgetQuota.dailyTokens / 1000).toFixed(0)}K tokens/day` : '—';
        const cost = role.budgetQuota ? `$${role.budgetQuota.maxCostPerTask}/task` : '—';
        console.log(`│  ${roleId.padEnd(14)} │ ${model.padEnd(6)} │ ${tokens.padEnd(16)} │ ${cost.padEnd(8)} │ ${role.riskTier} risk`);
      }
      console.log('│');
    }
  }

  // Show unassigned roles
  const teamRoles = new Set((org.teams || []).flatMap(t => t.roles));
  const unassigned = org.roles.filter(r => !teamRoles.has(r.roleId));
  if (unassigned.length > 0) {
    console.log('└─ Unassigned');
    for (const role of unassigned) {
      const model = role.modelPolicy?.default || 'sonnet';
      console.log(`   ${role.roleId.padEnd(14)} │ ${model.padEnd(6)} │ ${role.riskTier} risk`);
    }
  }

  console.log('');
  console.log('Providers:');
  for (const provider of org.providers) {
    const status = provider.enabled ? 'enabled' : 'disabled';
    const modelNames = provider.models.map(m => m.name).join(', ') || '—';
    console.log(`  ${provider.name} (${status}) — ${modelNames}`);
  }

  console.log('');
  console.log(`Budget: $${org.budget.dailyLimit}/day, $${org.budget.monthlyLimit}/month`);
  return 0;
}

export async function orgValidate() {
  const orgPath = ORGSPEC_PATH();
  if (!existsSync(orgPath)) {
    console.error('OrgSpec.json not found. Run: ogu org:init');
    return 1;
  }

  try {
    const org = JSON.parse(readFileSync(orgPath, 'utf8'));

    // Structural validation via Zod
    const { OrgSpecSchema } = await import('../../contracts/schemas/org-spec.mjs');
    OrgSpecSchema.parse(org);

    // Integrity validation
    validateOrgSpec(org);

    console.log('OrgSpec.json: VALID');
    console.log(`  Roles: ${org.roles.length}`);
    console.log(`  Teams: ${(org.teams || []).length}`);
    console.log(`  Providers: ${org.providers.length}`);
    return 0;
  } catch (err) {
    console.error('OrgSpec.json: INVALID');
    if (err.errors) {
      for (const e of err.errors) {
        console.error(`  ${e.path.join('.')}: ${e.message}`);
      }
    } else {
      console.error(`  ${err.message}`);
    }
    return 1;
  }
}
