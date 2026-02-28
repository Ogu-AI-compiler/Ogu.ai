/**
 * Contract Doc Generator — generate .contract.md files from schemas.
 */

export const CONTRACT_TEMPLATES = [
  {
    name: 'OrgSpec',
    version: '2.0',
    description: 'Organization specification: roles, teams, capabilities, model policies, budget quotas',
    schema: {
      version: { type: 'string' },
      roles: { type: 'array', items: { required: ['id', 'label', 'capabilities', 'modelPolicy', 'budgetQuota', 'escalationPath', 'memoryScope', 'phases'] } },
      teams: { type: 'array', items: { required: ['id', 'members'] } },
    },
    invariants: [
      'Every role must have a unique id',
      'escalationPath must only reference valid role IDs',
      'modelPolicy.escalationChain must contain valid model IDs',
      'budgetQuota.dailyTokens must be a positive number',
      'Team members must reference existing role IDs',
    ],
  },
  {
    name: 'Budget',
    version: '1.0',
    description: 'Budget tracking: per-role token usage, cost accounting, alert thresholds',
    schema: {
      dailyLimit: { type: 'number' },
      byRole: { type: 'object', description: 'Map of roleId → { tokensIn, tokensOut, cost, tasks }' },
      byModel: { type: 'object' },
      thresholds: { type: 'array', items: { type: 'number' } },
    },
    invariants: [
      'Daily limit must be positive',
      'Threshold values must be between 0 and 1',
      'byRole totals must equal sum of transaction log entries',
      'Cost must be non-negative',
    ],
  },
  {
    name: 'Audit',
    version: '1.0',
    description: 'Audit event log: immutable JSONL entries with required fields',
    schema: {
      id: { type: 'string', format: 'uuid' },
      timestamp: { type: 'string', format: 'iso-8601' },
      type: { type: 'string' },
      agentId: { type: 'string' },
      feature: { type: 'string' },
      modelUsed: { type: 'string' },
      tokensConsumed: { type: 'number' },
      artifactProduced: { type: 'string' },
    },
    invariants: [
      'Events are append-only — no updates or deletes',
      'Every event must have id, timestamp, type, agentId',
      'Daily rotation archives to YYYY-MM-DD.jsonl',
      'Index must be rebuilt after rotation',
    ],
  },
  {
    name: 'Governance',
    version: '1.0',
    description: 'Governance policies: rules, triggers, approval lifecycle, escalation',
    schema: {
      policies: { type: 'array', items: { required: ['id', 'trigger', 'effect', 'priority'] } },
      approvals: { type: 'array', items: { required: ['id', 'requestor', 'approver', 'action', 'status'] } },
    },
    invariants: [
      'Policy IDs must be unique',
      'Trigger must be one of: scope_violation, path_match, budget_exceeded, risk_tier',
      'Effect must be one of: allow, deny, requires_approval',
      'Approval state machine: pending → approved | denied | escalated | timed_out',
      'Terminal states (approved, denied, timed_out) cannot be transitioned from',
    ],
  },
  {
    name: 'Kadima',
    version: '1.0',
    description: 'Kadima orchestrator: agent allocation, task routing, worktree management',
    schema: {
      allocations: { type: 'array', items: { required: ['taskId', 'agentId', 'priority', 'assignedAt'] } },
      agents: { type: 'array', items: { required: ['id', 'capabilities', 'maxConcurrent'] } },
    },
    invariants: [
      'Agent cannot exceed maxConcurrent active tasks',
      'Task allocation requires matching capabilities',
      'Worktree must be created before agent starts executing',
      'Completed tasks must free agent capacity',
      'Kadima daemon exposes: /health, /api/features, /api/dashboard, /api/events, /api/metrics, /api/budget',
    ],
  },
  {
    name: 'Kadima_Ogu',
    version: '1.0',
    description: 'Boundary contract between Kadima (orchestrator) and Ogu (compiler)',
    schema: {
      InputEnvelope: { required: ['taskId', 'agentId', 'feature', 'phase', 'context'] },
      OutputEnvelope: { required: ['taskId', 'agentId', 'result', 'artifacts', 'metrics'] },
      ErrorEnvelope: { required: ['taskId', 'agentId', 'error', 'code', 'recoverable'] },
    },
    invariants: [
      'Every Ogu invocation receives an InputEnvelope',
      'Every Ogu completion returns an OutputEnvelope',
      'Failures return an ErrorEnvelope with OGU error code',
      'Escalation uses EscalationProtocol with fromRole/toRole/reason',
    ],
  },
];

/**
 * Generate a contract markdown document.
 */
export function generateContractDoc({ name, version, description, schema, invariants = [], examples = [] }) {
  const lines = [];
  lines.push(`# ${name} Contract v${version}`);
  lines.push('');
  lines.push(`> ${description}`);
  lines.push('');
  lines.push('## Schema');
  lines.push('');
  lines.push('| Field | Type | Required |');
  lines.push('|-------|------|----------|');

  if (schema) {
    for (const [field, def] of Object.entries(schema)) {
      const type = def.type || 'object';
      const req = def.required ? 'Yes' : '-';
      lines.push(`| \`${field}\` | ${type} | ${req} |`);
      if (def.items && def.items.required) {
        for (const rf of def.items.required) {
          lines.push(`| \`${field}[].${rf}\` | - | Yes |`);
        }
      }
    }
  }

  lines.push('');
  lines.push('## Invariants');
  lines.push('');
  lines.push('The following invariant rules must hold at all times:');
  lines.push('');
  for (const inv of invariants) {
    lines.push(`- ${inv}`);
  }

  if (examples.length > 0) {
    lines.push('');
    lines.push('## Examples');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(examples, null, 2));
    lines.push('```');
  }

  lines.push('');
  lines.push('---');
  lines.push(`*Generated by Ogu Contract Generator*`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate all contract docs from templates.
 */
export function generateAllContracts() {
  const docs = {};
  for (const tmpl of CONTRACT_TEMPLATES) {
    docs[tmpl.name] = generateContractDoc(tmpl);
  }
  return docs;
}
