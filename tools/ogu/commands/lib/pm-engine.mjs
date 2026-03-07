/**
 * pm-engine.mjs — Slice 418
 * PM Structured PRD generator.
 *
 * Two modes:
 *   simulate: true  — deterministic PRD from keyword/signal analysis (no LLM, for tests)
 *   simulate: false — LLM call (Haiku) returns PRD JSON matching schema
 *
 * Input:  brief (string), ctoPlan (from cto-planner), opts
 * Output: prd.json at .ogu/projects/{projectId}/prd.json
 *         prd.md (optional, human-readable snapshot)
 *
 * The PRD is the formal input to the Architecture layer (Slice 419 Task Graph enrichment).
 * PM responsibility: product definition only. No task decomposition.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectsDir } from './runtime-paths.mjs';

// ── Schema validation ─────────────────────────────────────────────────────────

const REQUIRED_META   = ['version', 'created_at'];
const REQUIRED_PRODUCT = ['name', 'one_liner', 'target_users', 'primary_value'];
const REQUIRED_NF     = ['performance', 'security', 'reliability', 'observability'];
const FEATURE_REQUIRED = ['id', 'title', 'priority', 'acceptance_criteria'];
const VALID_PRIORITIES = new Set(['must', 'should', 'could']);

/**
 * validatePRD(prd) → { valid: boolean, errors: string[] }
 */
export function validatePRD(prd) {
  const errors = [];
  if (!prd || typeof prd !== 'object') { return { valid: false, errors: ['PRD is not an object'] }; }

  for (const f of REQUIRED_META)    if (!prd.meta?.[f])    errors.push(`meta.${f} missing`);
  for (const f of REQUIRED_PRODUCT) if (!prd.product?.[f]) errors.push(`product.${f} missing`);
  for (const f of REQUIRED_NF)      if (!prd.non_functional?.[f]) errors.push(`non_functional.${f} missing`);

  if (!Array.isArray(prd.features) || prd.features.length === 0) {
    errors.push('features must be a non-empty array');
  } else {
    for (const feat of prd.features) {
      for (const f of FEATURE_REQUIRED) {
        if (!feat[f]) errors.push(`feature "${feat.id || '?'}": ${f} missing`);
      }
      if (feat.priority && !VALID_PRIORITIES.has(feat.priority)) {
        errors.push(`feature "${feat.id}": invalid priority "${feat.priority}"`);
      }
      if (Array.isArray(feat.acceptance_criteria) && feat.priority === 'must' && feat.acceptance_criteria.length === 0) {
        errors.push(`feature "${feat.id}": must-have feature needs acceptance criteria`);
      }
    }
  }

  if (!Array.isArray(prd.out_of_scope))    errors.push('out_of_scope must be an array');
  if (!Array.isArray(prd.success_metrics)) errors.push('success_metrics must be an array');

  return { valid: errors.length === 0, errors };
}

// ── Simulate mode (deterministic) ─────────────────────────────────────────────

// Feature templates keyed by signal
const SIGNAL_FEATURES = {
  // Always present
  'user-auth': {
    id: 'feat-auth', title: 'User Authentication', priority: 'must',
    description: 'Account creation, login, and session management.',
    flows: ['sign-up flow', 'login flow', 'password reset flow'],
    acceptance_criteria: [
      'User can register with email and password',
      'User receives confirmation email after registration',
      'User can log in with valid credentials',
      'Invalid credentials show a clear error message',
      'Session persists across page refreshes',
    ],
    edge_cases: ['Duplicate email registration', 'Expired session handling'],
    dependencies: [],
    entities: ['User', 'Session'],
  },
  'user-profile': {
    id: 'feat-profile', title: 'User Profile Management', priority: 'should',
    description: 'View and update personal information.',
    flows: ['view profile flow', 'edit profile flow'],
    acceptance_criteria: [
      'User can view their profile information',
      'User can update display name and avatar',
      'Changes are saved immediately',
    ],
    edge_cases: ['Invalid image format upload'],
    dependencies: ['feat-auth'],
    entities: ['User'],
  },

  // High signals
  payment: {
    id: 'feat-payment', title: 'Payment Processing', priority: 'must',
    description: 'Secure payment collection and management via third-party processor.',
    flows: ['checkout flow', 'refund flow', 'subscription renewal flow'],
    acceptance_criteria: [
      'User can enter payment details securely',
      'Successful payment shows confirmation and receipt',
      'Failed payment shows actionable error',
      'Refunds are processed within defined SLA',
      'Payment history is accessible to user',
    ],
    edge_cases: ['Card declined mid-flow', 'Network timeout during payment', 'Duplicate charge prevention'],
    dependencies: ['feat-auth'],
    entities: ['Payment', 'Invoice', 'Transaction'],
  },
  realtime: {
    id: 'feat-realtime', title: 'Real-time Updates', priority: 'must',
    description: 'Live data synchronization without page refresh.',
    flows: ['live update flow', 'reconnection flow'],
    acceptance_criteria: [
      'Data updates appear within 500ms of change',
      'Connection loss is indicated to user',
      'System reconnects automatically on restore',
      'No data is lost during brief disconnections',
    ],
    edge_cases: ['Slow connection degradation', 'Multiple tabs open'],
    dependencies: [],
    entities: ['Event', 'Channel'],
  },
  mobile: {
    id: 'feat-mobile', title: 'Mobile Application', priority: 'must',
    description: 'Native mobile experience on iOS and Android.',
    flows: ['onboarding flow', 'core feature flow', 'push notification flow'],
    acceptance_criteria: [
      'App installs and runs on iOS 15+ and Android 10+',
      'Core features work offline with sync on reconnect',
      'Push notifications are delivered reliably',
      'App passes App Store and Play Store review criteria',
    ],
    edge_cases: ['Background app termination', 'Low memory conditions'],
    dependencies: ['feat-auth'],
    entities: ['Device', 'PushToken'],
  },

  // Medium signals
  dashboard: {
    id: 'feat-dashboard', title: 'Admin Dashboard', priority: 'should',
    description: 'Management interface for operators and administrators.',
    flows: ['data overview flow', 'report export flow'],
    acceptance_criteria: [
      'Admin can view key metrics at a glance',
      'Data tables are searchable and filterable',
      'Reports can be exported as CSV',
      'Dashboard loads within 2 seconds',
    ],
    edge_cases: ['No data state', 'Large dataset pagination'],
    dependencies: ['feat-auth'],
    entities: ['Report', 'Metric'],
  },
  notification: {
    id: 'feat-notifications', title: 'Notification System', priority: 'should',
    description: 'In-app and email notifications for key events.',
    flows: ['notification delivery flow', 'preference management flow'],
    acceptance_criteria: [
      'User receives notification for relevant events',
      'User can manage notification preferences',
      'Email notifications include unsubscribe link',
      'Notifications are marked read/unread',
    ],
    edge_cases: ['Notification flood prevention', 'Unsubscribed user handling'],
    dependencies: ['feat-auth'],
    entities: ['Notification', 'NotificationPreference'],
  },
  search: {
    id: 'feat-search', title: 'Search', priority: 'should',
    description: 'Full-text search across primary content.',
    flows: ['search query flow', 'filter and refine flow'],
    acceptance_criteria: [
      'Results appear within 500ms',
      'Search is case-insensitive',
      'No results state is shown with suggestions',
      'Results can be filtered by type or date',
    ],
    edge_cases: ['Empty query', 'Special characters in query'],
    dependencies: [],
    entities: ['SearchIndex'],
  },
};

// Non-functional defaults by tier
const NF_BY_TIER = {
  low: {
    performance: 'Page load under 3s on 4G. API responses under 500ms for 95th percentile.',
    security: 'HTTPS everywhere. Passwords hashed with bcrypt. No sensitive data in logs.',
    reliability: '99% uptime. Daily automated backups.',
    observability: 'Error logging with timestamps. Basic health endpoint.',
  },
  medium: {
    performance: 'Page load under 2s. API p95 under 300ms. DB queries indexed for common paths.',
    security: 'JWT tokens with expiry. Rate limiting on auth endpoints. OWASP Top 10 coverage.',
    reliability: '99.5% uptime. Automated backups with tested restore procedure. Graceful degradation.',
    observability: 'Structured logging. Request tracing. Error alerting within 5 minutes.',
  },
  high: {
    performance: 'p95 API under 100ms. CDN for static assets. DB read replicas for heavy reads.',
    security: 'Zero-trust network model. Secrets management (Vault/AWS SSM). Penetration testing pre-launch.',
    reliability: '99.9% uptime SLA. Multi-region failover. Chaos testing in staging.',
    observability: 'Distributed tracing. Real-time dashboards. On-call alerting with runbooks.',
  },
};

// Out of scope by tier
const OOS_BY_TIER = {
  low: ['Multi-language support', 'White-labelling', 'Mobile native app'],
  medium: ['AI/ML features', 'Third-party plugin marketplace', 'Multi-region deployment'],
  high: ['Physical hardware integration', 'Regulatory compliance (HIPAA/SOC2) — future phase'],
};

// Success metrics by product type
const METRICS_BY_TYPE = {
  marketplace: ['Gross Merchandise Volume (GMV)', 'Listings created per week', 'Buyer-seller match rate'],
  saas: ['Monthly Recurring Revenue (MRR)', 'Churn rate < 5%', 'Daily Active Users (DAU)'],
  ecommerce: ['Conversion rate > 2%', 'Cart abandonment rate', 'Average Order Value (AOV)'],
  social: ['Daily Active Users (DAU)', 'Posts per user per week', 'Retention at D7/D30'],
  analytics: ['Dashboard load time < 2s', 'Report accuracy vs source', 'Weekly active analysts'],
  api: ['API uptime 99.9%', 'Average response time', 'Developer onboarding time'],
  default: ['Feature adoption rate', 'User satisfaction (NPS > 40)', 'Error rate < 0.1%'],
};

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0;
  return h.toString(16).slice(0, 8);
}

/**
 * simulatePRD(brief, ctoPlan) → PRDJson
 * Deterministic PRD generation from complexity signals. No LLM required.
 */
export function simulatePRD(brief, ctoPlan) {
  const briefText = typeof brief === 'string' ? brief : JSON.stringify(brief);
  const complexity = ctoPlan?.complexity || { tier: 'medium', product_type: 'general', signals: { high: [], medium: [], low: [] }, integrations: [] };
  const tier = complexity.tier || 'medium';

  // Detect product name: first Title-Case word sequence or fallback
  const nameMatch = briefText.match(/\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)\b/);
  const productName = nameMatch ? nameMatch[1] : 'Product';

  // Build feature set from signals
  const featureSet = new Map();
  // Always include auth + profile
  featureSet.set('user-auth', { ...SIGNAL_FEATURES['user-auth'] });
  featureSet.set('user-profile', { ...SIGNAL_FEATURES['user-profile'] });

  // Add from high signals
  for (const sig of (complexity.signals?.high || [])) {
    const key = Object.keys(SIGNAL_FEATURES).find(k => sig.includes(k) || k.includes(sig.split(' ')[0]));
    if (key && !featureSet.has(key)) featureSet.set(key, { ...SIGNAL_FEATURES[key] });
  }

  // Add from medium signals
  for (const sig of (complexity.signals?.medium || [])) {
    const key = Object.keys(SIGNAL_FEATURES).find(k => sig.includes(k) || k.includes(sig.split(' ')[0]));
    if (key && !featureSet.has(key)) featureSet.set(key, { ...SIGNAL_FEATURES[key] });
  }

  // Ensure medium/high have at least a dashboard feature
  if (tier !== 'low' && !featureSet.has('dashboard')) {
    featureSet.set('dashboard', { ...SIGNAL_FEATURES['dashboard'] });
  }

  const features = [...featureSet.values()].map(({ entities: _e, ...f }) => ({
    ...f,
    flows: f.flows || [],
    acceptance_criteria: f.acceptance_criteria || [],
    edge_cases: f.edge_cases || [],
    dependencies: f.dependencies || [],
  }));

  // Collect all data entities
  const entitySet = new Set();
  for (const feat of featureSet.values()) {
    for (const e of (feat.entities || [])) entitySet.add(e);
  }
  const data_entities = [...entitySet].map(name => ({
    name,
    description: `Core ${name.toLowerCase()} entity.`,
    key_fields: ['id', 'created_at'],
  }));

  // Integrations from CTO plan
  const integrations = (complexity.integrations || []).map(name => ({
    name,
    direction: 'outbound',
    notes: `Third-party integration for ${name}.`,
  }));

  const metrics = METRICS_BY_TYPE[complexity.product_type] || METRICS_BY_TYPE.default;

  return {
    meta: {
      version: '1.0',
      created_at: new Date().toISOString(),
      brief_hash: simpleHash(briefText),
      blueprint_hash: ctoPlan ? simpleHash(JSON.stringify(ctoPlan.teamBlueprint || {})) : '00000000',
    },
    product: {
      name: productName,
      one_liner: `${productName}: ${briefText.slice(0, 80).replace(/\n/g, ' ')}...`,
      target_users: 'End users and administrators',
      primary_value: `Deliver ${features[0]?.title || 'core functionality'} reliably and securely.`,
    },
    features,
    data_entities,
    integrations,
    non_functional: { ...NF_BY_TIER[tier] },
    out_of_scope: OOS_BY_TIER[tier],
    success_metrics: metrics,
    assumptions: [
      'Team has access to required third-party API keys',
      'Development environment is set up before sprint 1',
    ],
    open_questions: [
      'What is the expected peak concurrent user load?',
      'Are there existing design assets or a style guide?',
    ],
  };
}

// ── LLM mode ──────────────────────────────────────────────────────────────────

const PRD_SYSTEM_PROMPT = `You are a senior Product Manager. Given a project brief and team blueprint, produce a structured PRD as valid JSON.
Return ONLY the JSON object — no markdown fences, no explanation, no comments.
The JSON must match this exact schema:
{
  "meta": { "version": "1.0", "created_at": "<ISO>", "brief_hash": "<str>", "blueprint_hash": "<str>" },
  "product": { "name": "<str>", "one_liner": "<str>", "target_users": "<str>", "primary_value": "<str>" },
  "features": [{ "id": "feat-001", "title": "<str>", "description": "<str>", "priority": "must|should|could", "flows": ["<str>"], "acceptance_criteria": ["<str>"], "edge_cases": ["<str>"], "dependencies": [] }],
  "data_entities": [{ "name": "<str>", "description": "<str>", "key_fields": ["<str>"] }],
  "integrations": [{ "name": "<str>", "direction": "inbound|outbound|both", "notes": "<str>" }],
  "non_functional": { "performance": "<str>", "security": "<str>", "reliability": "<str>", "observability": "<str>" },
  "out_of_scope": ["<str>"],
  "success_metrics": ["<str>"],
  "assumptions": ["<str>"],
  "open_questions": ["<str>"]
}
Rules:
- features must have at least 3 items
- every must-have feature must have at least 3 acceptance_criteria
- id format: feat-NNN (zero-padded)
- Return ONLY the JSON.`;

/**
 * repairPRD(raw, brief, ctoPlan) → PRDJson
 * Strips markdown, attempts JSON.parse, throws on failure.
 */
export function repairPRD(raw, brief, ctoPlan) {
  if (typeof raw !== 'string') {
    throw new Error('PRD response is not a string');
  }

  // Strip markdown fences
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    // Patch required fields if missing
    if (!parsed.meta) parsed.meta = {};
    if (!parsed.meta.version) parsed.meta.version = '1.0';
    if (!parsed.meta.created_at) parsed.meta.created_at = new Date().toISOString();
    if (!Array.isArray(parsed.features)) parsed.features = [];
    if (!Array.isArray(parsed.out_of_scope)) parsed.out_of_scope = [];
    if (!Array.isArray(parsed.success_metrics)) parsed.success_metrics = [];
    if (!Array.isArray(parsed.data_entities)) parsed.data_entities = [];
    if (!Array.isArray(parsed.integrations)) parsed.integrations = [];
    if (!Array.isArray(parsed.assumptions)) parsed.assumptions = [];
    if (!Array.isArray(parsed.open_questions)) parsed.open_questions = [];
    if (!parsed.non_functional) parsed.non_functional = NF_BY_TIER.medium;
    if (!parsed.product) parsed.product = {};
    return parsed;
  } catch {
    throw new Error('Failed to parse PRD JSON from LLM response');
  }
}

// ── Main generator ─────────────────────────────────────────────────────────────

/**
 * generatePRD(brief, ctoPlan, opts?) → PRDJson
 *
 * brief: string | object — project brief from wizard
 * ctoPlan: CTOPlan from cto-planner
 * opts.simulate: boolean — skip LLM, use deterministic mode (default: false)
 * opts.provider / opts.model: LLM config (default: anthropic / claude-haiku-4-5-20251001)
 */
export async function generatePRD(brief, ctoPlan, opts = {}) {
  const briefText = typeof brief === 'string' ? brief : JSON.stringify(brief);

  if (opts.simulate) {
    console.warn('[pm-engine] simulate requested but disabled — forcing real API call');
  }

  // LLM mode
  const { callLLM } = await import('./llm-client.mjs');
  const provider = opts.provider || 'anthropic';
  const model = opts.model || 'claude-haiku-4-5-20251001';

  const userMessage = [
    `Brief: ${briefText}`,
    '',
    `Complexity tier: ${ctoPlan?.complexity?.tier || 'medium'}`,
    `Product type: ${ctoPlan?.complexity?.product_type || 'general'}`,
    `Detected signals: ${JSON.stringify(ctoPlan?.complexity?.signals || {})}`,
    `Integrations: ${JSON.stringify(ctoPlan?.complexity?.integrations || [])}`,
    '',
    `Team blueprint: ${JSON.stringify(ctoPlan?.teamBlueprint?.roles?.map(r => r.role_display) || [])}`,
    '',
    'Return the PRD JSON only.',
  ].join('\n');

  let raw = '';
  try {
    const result = await callLLM({
      provider,
      model,
      messages: [{ role: 'user', content: userMessage }],
      system: PRD_SYSTEM_PROMPT,
      maxTokens: 4096,
      temperature: 0,
    });
    raw = result.content || result.text || '';
  } catch (err) {
    throw new Error(`PRD generation failed: ${err?.message || err}`);
  }

  const prd = repairPRD(raw, briefText, ctoPlan);
  // Stamp hashes
  if (!prd.meta.brief_hash) prd.meta.brief_hash = simpleHash(briefText);
  if (!prd.meta.blueprint_hash) {
    prd.meta.blueprint_hash = ctoPlan ? simpleHash(JSON.stringify(ctoPlan.teamBlueprint || {})) : '00000000';
  }
  return prd;
}

// ── Markdown snapshot ─────────────────────────────────────────────────────────

/**
 * prdToMarkdown(prd) → string
 * Human-readable snapshot of the PRD for documentation.
 */
export function prdToMarkdown(prd) {
  const lines = [];
  lines.push(`# PRD: ${prd.product?.name || 'Product'}`);
  lines.push(`> ${prd.product?.one_liner || ''}`);
  lines.push('');
  lines.push(`**Target users:** ${prd.product?.target_users || ''}`);
  lines.push(`**Primary value:** ${prd.product?.primary_value || ''}`);
  lines.push('');

  lines.push('## Features');
  for (const feat of (prd.features || [])) {
    lines.push(`\n### [${feat.priority?.toUpperCase()}] ${feat.title} \`${feat.id}\``);
    lines.push(feat.description || '');
    if (feat.flows?.length) {
      lines.push('\n**Flows:** ' + feat.flows.join(', '));
    }
    if (feat.acceptance_criteria?.length) {
      lines.push('\n**Acceptance Criteria:**');
      for (const ac of feat.acceptance_criteria) lines.push(`- ${ac}`);
    }
    if (feat.edge_cases?.length) {
      lines.push('\n**Edge Cases:** ' + feat.edge_cases.join(', '));
    }
  }

  lines.push('\n## Data Entities');
  for (const e of (prd.data_entities || [])) {
    lines.push(`- **${e.name}**: ${e.description} Fields: ${(e.key_fields || []).join(', ')}`);
  }

  lines.push('\n## Non-Functional Requirements');
  const nf = prd.non_functional || {};
  if (nf.performance) lines.push(`- **Performance:** ${nf.performance}`);
  if (nf.security) lines.push(`- **Security:** ${nf.security}`);
  if (nf.reliability) lines.push(`- **Reliability:** ${nf.reliability}`);
  if (nf.observability) lines.push(`- **Observability:** ${nf.observability}`);

  if (prd.out_of_scope?.length) {
    lines.push('\n## Out of Scope');
    for (const s of prd.out_of_scope) lines.push(`- ${s}`);
  }

  if (prd.success_metrics?.length) {
    lines.push('\n## Success Metrics');
    for (const m of prd.success_metrics) lines.push(`- ${m}`);
  }

  lines.push(`\n---\n_Generated ${prd.meta?.created_at || ''}_`);
  return lines.join('\n');
}

// ── Storage ───────────────────────────────────────────────────────────────────

function projectDir(root, projectId) {
  return join(getProjectsDir(root), projectId);
}

/**
 * savePRD(root, projectId, prd, opts?) → void
 * opts.writeMarkdown: boolean — also write prd.md
 */
export function savePRD(root, projectId, prd, opts = {}) {
  const dir = projectDir(root, projectId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'prd.json'), JSON.stringify(prd, null, 2), 'utf-8');
  if (opts.writeMarkdown) {
    writeFileSync(join(dir, 'prd.md'), prdToMarkdown(prd), 'utf-8');
  }
}

/**
 * loadPRD(root, projectId) → PRDJson | null
 */
export function loadPRD(root, projectId) {
  const path = join(projectDir(root, projectId), 'prd.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return null; }
}
