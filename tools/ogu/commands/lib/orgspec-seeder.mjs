/**
 * OrgSpec Seeder — generate full 10-role OrgSpec with modelPolicy/budgetQuota.
 */

export const DEFAULT_ROLES = [
  'pm', 'architect', 'designer', 'backend-dev', 'frontend-dev',
  'qa', 'security', 'devops', 'tech-lead', 'cto',
];

const ROLE_DEFINITIONS = {
  pm: {
    label: 'Product Manager',
    capabilities: ['prd', 'feature-spec', 'prioritization', 'stakeholder-comm'],
    phases: ['idea', 'feature'],
    modelPolicy: { defaultModel: 'sonnet', escalationChain: ['sonnet', 'opus'] },
    budgetQuota: { dailyTokens: 100000 },
    escalationPath: ['tech-lead', 'cto'],
    memoryScope: ['features', 'prd', 'stakeholder'],
  },
  architect: {
    label: 'Architect',
    capabilities: ['spec', 'adr', 'contracts', 'ir-design', 'plan-json'],
    phases: ['architect'],
    modelPolicy: { defaultModel: 'opus', escalationChain: ['opus'] },
    budgetQuota: { dailyTokens: 200000 },
    escalationPath: ['cto'],
    memoryScope: ['spec', 'contracts', 'adr', 'ir'],
  },
  designer: {
    label: 'Designer',
    capabilities: ['design-system', 'tokens', 'visual-audit', 'brand'],
    phases: ['design'],
    modelPolicy: { defaultModel: 'sonnet', escalationChain: ['sonnet', 'opus'] },
    budgetQuota: { dailyTokens: 80000 },
    escalationPath: ['tech-lead', 'cto'],
    memoryScope: ['design', 'tokens', 'brand'],
  },
  'backend-dev': {
    label: 'Backend Developer',
    capabilities: ['api', 'database', 'server', 'testing', 'implementation'],
    phases: ['build'],
    modelPolicy: { defaultModel: 'sonnet', escalationChain: ['sonnet', 'opus'] },
    budgetQuota: { dailyTokens: 300000 },
    escalationPath: ['tech-lead', 'architect'],
    memoryScope: ['code', 'api', 'tests'],
  },
  'frontend-dev': {
    label: 'Frontend Developer',
    capabilities: ['ui', 'components', 'styling', 'accessibility', 'implementation'],
    phases: ['build'],
    modelPolicy: { defaultModel: 'sonnet', escalationChain: ['sonnet', 'opus'] },
    budgetQuota: { dailyTokens: 300000 },
    escalationPath: ['tech-lead', 'designer'],
    memoryScope: ['code', 'ui', 'components'],
  },
  qa: {
    label: 'QA Engineer',
    capabilities: ['e2e-testing', 'smoke-testing', 'visual-testing', 'regression'],
    phases: ['smoke', 'verify-ui', 'vision'],
    modelPolicy: { defaultModel: 'haiku', escalationChain: ['haiku', 'sonnet'] },
    budgetQuota: { dailyTokens: 150000 },
    escalationPath: ['tech-lead'],
    memoryScope: ['tests', 'qa', 'regression'],
  },
  security: {
    label: 'Security Engineer',
    capabilities: ['audit', 'vulnerability-scan', 'policy-review', 'compliance'],
    phases: ['enforce', 'verify-ui'],
    modelPolicy: { defaultModel: 'opus', escalationChain: ['opus'] },
    budgetQuota: { dailyTokens: 100000 },
    escalationPath: ['cto'],
    memoryScope: ['security', 'audit', 'compliance'],
  },
  devops: {
    label: 'DevOps Engineer',
    capabilities: ['deployment', 'monitoring', 'infra', 'ci-cd', 'preview'],
    phases: ['preview', 'observe'],
    modelPolicy: { defaultModel: 'sonnet', escalationChain: ['sonnet', 'opus'] },
    budgetQuota: { dailyTokens: 150000 },
    escalationPath: ['tech-lead', 'cto'],
    memoryScope: ['infra', 'deploy', 'monitoring'],
  },
  'tech-lead': {
    label: 'Tech Lead',
    capabilities: ['code-review', 'architecture-review', 'mentoring', 'escalation-handling'],
    phases: ['architect', 'build', 'enforce'],
    modelPolicy: { defaultModel: 'opus', escalationChain: ['opus'] },
    budgetQuota: { dailyTokens: 250000 },
    escalationPath: ['cto'],
    memoryScope: ['all'],
  },
  cto: {
    label: 'CTO',
    capabilities: ['final-approval', 'strategic-decisions', 'budget-override', 'org-evolution'],
    phases: ['all'],
    modelPolicy: { defaultModel: 'opus', escalationChain: ['opus'] },
    budgetQuota: { dailyTokens: 500000 },
    escalationPath: [],
    memoryScope: ['all'],
  },
};

/**
 * Generate a full 10-role OrgSpec.
 *
 * @returns {object} OrgSpec with roles array
 */
export function seedOrgSpec() {
  const roles = DEFAULT_ROLES.map(id => ({
    id,
    ...ROLE_DEFINITIONS[id],
  }));

  return {
    version: '2.0',
    roles,
    teams: [
      { id: 'core', members: ['pm', 'architect', 'tech-lead', 'cto'] },
      { id: 'engineering', members: ['backend-dev', 'frontend-dev', 'devops'] },
      { id: 'quality', members: ['qa', 'security'] },
      { id: 'design', members: ['designer'] },
    ],
    createdAt: new Date().toISOString(),
  };
}
