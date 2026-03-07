/**
 * cto-planner.mjs — Slice 416
 * One-time project planning step: brief → complexity + TeamBlueprint + work framework.
 *
 * The CTO is a planning role, not an execution role. It runs once at project start
 * and produces three structured outputs consumed by downstream pipeline stages:
 *   1. complexity  — tier, score, detected signals, risk factors
 *   2. teamBlueprint — roles needed (count, optional, rationale)
 *   3. workFramework — architecture type, required docs, quality gates, phases
 *
 * All logic is deterministic (keyword-based). No LLM required for core path.
 * LLM enrichment is opt-in via opts.enrichWithLLM (adds summaries/rationale).
 *
 * Storage: .ogu/projects/{projectId}/cto-plan.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectsDir } from './runtime-paths.mjs';

// ── Complexity signals ────────────────────────────────────────────────────────

const HIGH_SIGNALS = new Set([
  'realtime', 'websocket', 'socket.io', 'streaming', 'pubsub',
  'machine learning', 'ml model', 'ai model', 'recommendation engine', 'vector',
  'payment', 'stripe', 'billing', 'subscription', 'invoice',
  'oauth', 'sso', 'saml', 'ldap', 'identity',
  'mobile app', 'ios', 'android', 'react native', 'flutter',
  'microservice', 'distributed', 'kubernetes', 'k8s', 'service mesh',
  'blockchain', 'smart contract', 'nft', 'defi',
  'video', 'audio', 'media processing', 'ffmpeg', 'transcoding',
  'high traffic', 'large scale', 'millions', 'cdn', 'edge',
  'multi-tenant', 'saas', 'white-label',
]);

const MEDIUM_SIGNALS = new Set([
  'authentication', 'auth', 'login', 'signup', 'jwt', 'session',
  'api', 'rest', 'graphql', 'webhook', 'integration',
  'database', 'postgres', 'mysql', 'mongodb', 'redis',
  'notification', 'email', 'sms', 'push notification',
  'admin', 'dashboard', 'analytics', 'reporting',
  'file upload', 'storage', 's3', 'cloud storage',
  'search', 'filter', 'pagination',
  'user profile', 'role', 'permission', 'rbac',
  'scheduling', 'cron', 'job queue', 'background job',
  'chat', 'messaging', 'comment',
]);

const LOW_SIGNALS = new Set([
  'landing page', 'portfolio', 'blog', 'static site',
  'crud', 'simple', 'prototype', 'mvp', 'poc',
  'read-only', 'display', 'showcase',
]);

const PRODUCT_TYPE_MAP = {
  marketplace: ['marketplace', 'listing', 'buyer', 'seller', 'vendor', 'shop'],
  saas: ['saas', 'subscription', 'multi-tenant', 'workspace', 'organization'],
  ecommerce: ['ecommerce', 'e-commerce', 'store', 'cart', 'checkout', 'product catalog'],
  social: ['social', 'feed', 'follow', 'like', 'share', 'community', 'network'],
  analytics: ['analytics', 'dashboard', 'reporting', 'metrics', 'kpi', 'data visualization'],
  api: ['api', 'sdk', 'developer', 'integration', 'webhook'],
  mobile: ['mobile', 'ios', 'android', 'app', 'native'],
  tool: ['tool', 'utility', 'productivity', 'automation', 'workflow'],
  platform: ['platform', 'infrastructure', 'service', 'engine'],
};

// ── Team templates by complexity tier ────────────────────────────────────────

const TEAM_TEMPLATES = {
  low: [
    { role_id: 'pm', role_display: 'Product Manager', count: 1, optional: false },
    { role_id: 'architect', role_display: 'Architect', count: 1, optional: false },
    { role_id: 'backend_engineer', role_display: 'Backend Engineer', count: 2, optional: false },
    { role_id: 'qa', role_display: 'QA Engineer', count: 1, optional: false },
  ],
  medium: [
    { role_id: 'pm', role_display: 'Product Manager', count: 1, optional: false },
    { role_id: 'architect', role_display: 'Architect', count: 1, optional: false },
    { role_id: 'backend_engineer', role_display: 'Backend Engineer', count: 3, optional: false },
    { role_id: 'frontend_engineer', role_display: 'Frontend Engineer', count: 2, optional: false },
    { role_id: 'qa', role_display: 'QA Engineer', count: 1, optional: false },
    { role_id: 'devops', role_display: 'DevOps Engineer', count: 1, optional: true },
  ],
  high: [
    { role_id: 'pm', role_display: 'Product Manager', count: 1, optional: false },
    { role_id: 'architect', role_display: 'Architect', count: 2, optional: false },
    { role_id: 'backend_engineer', role_display: 'Backend Engineer', count: 4, optional: false },
    { role_id: 'frontend_engineer', role_display: 'Frontend Engineer', count: 2, optional: false },
    { role_id: 'qa', role_display: 'QA Engineer', count: 2, optional: false },
    { role_id: 'devops', role_display: 'DevOps Engineer', count: 1, optional: false },
    { role_id: 'security', role_display: 'Security Engineer', count: 1, optional: true },
  ],
};

const ROLE_RATIONALE = {
  pm: 'Defines product requirements, maintains PRD, owns acceptance criteria.',
  architect: 'Designs system architecture, produces Task Graph, resolves technical decisions.',
  backend_engineer: 'Implements server-side logic, APIs, database layer.',
  frontend_engineer: 'Implements UI, client-side logic, design system integration.',
  qa: 'Writes and runs test plans, validates gates, catches regressions.',
  devops: 'CI/CD pipeline, infrastructure, deployment automation.',
  security: 'Threat modelling, auth hardening, secrets management.',
};

// ── Work framework templates ──────────────────────────────────────────────────

const ARCHITECTURE_MAP = {
  low: 'monolith',
  medium: 'modular-monolith',
  high: 'microservices',
};

const QUALITY_GATES_MAP = {
  low: ['type-check', 'build'],
  medium: ['type-check', 'unit-tests', 'build', 'lint'],
  high: ['type-check', 'unit-tests', 'integration-tests', 'build', 'lint', 'security-scan'],
};

const REQUIRED_DOCS_MAP = {
  low: ['PRD.md', 'Spec.md', 'Plan.json'],
  medium: ['PRD.md', 'Spec.md', 'Plan.json', 'DESIGN.md'],
  high: ['PRD.md', 'Spec.md', 'Plan.json', 'DESIGN.md', 'ADR/', 'SecuritySpec.md'],
};

const PHASES_MAP = {
  low: ['setup', 'core', 'testing', 'launch'],
  medium: ['setup', 'architecture', 'core', 'integration', 'testing', 'launch'],
  high: ['setup', 'architecture', 'infrastructure', 'core', 'integration', 'hardening', 'testing', 'launch'],
};

const TIMELINE_WEEKS = { low: 4, medium: 8, high: 16 };

// ── Core analysis functions ───────────────────────────────────────────────────

/**
 * assessComplexity(brief) → ComplexityAnalysis
 * Keyword-based scoring of project complexity from brief text.
 */
export function assessComplexity(brief) {
  const text = (typeof brief === 'string' ? brief : JSON.stringify(brief)).toLowerCase();

  const detectedHigh = [];
  const detectedMedium = [];
  const detectedLow = [];

  for (const signal of HIGH_SIGNALS) {
    if (text.includes(signal)) detectedHigh.push(signal);
  }
  for (const signal of MEDIUM_SIGNALS) {
    if (text.includes(signal)) detectedMedium.push(signal);
  }
  for (const signal of LOW_SIGNALS) {
    if (text.includes(signal)) detectedLow.push(signal);
  }

  // Score: high=3pts, medium=1pt, low=-1pt
  const score = (detectedHigh.length * 3) + detectedMedium.length - detectedLow.length;

  let tier;
  // High tier requires at least one architectural complexity signal (not just many medium signals)
  if (score >= 6 && detectedHigh.length >= 1) tier = 'high';
  else if (score >= 2) tier = 'medium';
  else tier = 'low';

  // Detect product type
  let product_type = 'general';
  let bestTypeScore = 0;
  for (const [type, keywords] of Object.entries(PRODUCT_TYPE_MAP)) {
    const typeScore = keywords.filter(k => text.includes(k)).length;
    if (typeScore > bestTypeScore) { bestTypeScore = typeScore; product_type = type; }
  }

  // Build risk factors from high signals
  const risk_factors = detectedHigh.map(s => {
    if (['payment', 'stripe', 'billing'].includes(s)) return 'third-party payment integration';
    if (['oauth', 'sso', 'saml', 'ldap'].includes(s)) return 'external identity provider dependency';
    if (['realtime', 'websocket'].includes(s)) return 'realtime concurrency complexity';
    if (['mobile app', 'ios', 'android'].includes(s)) return 'multi-platform deployment';
    if (['machine learning', 'ml model', 'ai model'].includes(s)) return 'ML model lifecycle management';
    if (['microservice', 'distributed'].includes(s)) return 'distributed systems failure modes';
    if (['high traffic', 'large scale', 'millions'].includes(s)) return 'scalability and performance';
    return s;
  }).filter((v, i, a) => a.indexOf(v) === i); // deduplicate

  const integrations = detectedHigh
    .filter(s => ['payment', 'stripe', 'oauth', 'sso', 'saml', 'email', 'sms'].includes(s));

  return {
    tier,
    score,
    product_type,
    signals: { high: detectedHigh, medium: detectedMedium, low: detectedLow },
    risk_factors,
    integrations,
  };
}

/**
 * buildTeamBlueprint(complexity, brief) → TeamBlueprint
 * Returns the team structure needed for this project.
 */
export function buildTeamBlueprint(complexity, brief = '') {
  const text = (typeof brief === 'string' ? brief : '').toLowerCase();
  const template = TEAM_TEMPLATES[complexity.tier].map(role => ({ ...role }));

  // Add frontend if UI terms detected and not already in template
  const hasUI = ['frontend', 'ui', 'react', 'vue', 'angular', 'interface', 'screen', 'page'].some(w => text.includes(w));
  const hasFrontend = template.some(r => r.role_id === 'frontend_engineer');
  if (hasUI && !hasFrontend) {
    const backendIdx = template.findIndex(r => r.role_id === 'backend_engineer');
    template.splice(backendIdx + 1, 0, {
      role_id: 'frontend_engineer',
      role_display: 'Frontend Engineer',
      count: 1,
      optional: false,
    });
  }

  const total_headcount = template.reduce((sum, r) => sum + r.count, 0);

  return {
    blueprint_id: `bp_${Date.now()}`,
    complexity_tier: complexity.tier,
    roles: template.map(r => ({
      ...r,
      rationale: ROLE_RATIONALE[r.role_id] || 'Specialist role for this project type.',
    })),
    total_headcount,
    total_slots: total_headcount, // one slot per head
  };
}

/**
 * buildWorkFramework(complexity) → WorkFramework
 * Returns the working constraints and structure for this project type.
 */
export function buildWorkFramework(complexity) {
  const tier = complexity.tier;
  return {
    architecture_type: ARCHITECTURE_MAP[tier],
    required_docs: REQUIRED_DOCS_MAP[tier],
    quality_gates: QUALITY_GATES_MAP[tier],
    phases: PHASES_MAP[tier],
    suggested_timeline_weeks: TIMELINE_WEEKS[tier],
    notes: tier === 'high'
      ? 'High-complexity project. Prioritize architecture phase before coding begins.'
      : tier === 'medium'
      ? 'Medium complexity. Begin with core features, add integrations in phase 2.'
      : 'Low complexity. Move fast, ship early, iterate.',
  };
}

// ── Main planner ──────────────────────────────────────────────────────────────

/**
 * planProject(brief, opts?) → CTOPlan
 * Full CTO analysis from a project brief.
 * brief: string (free text) or object (structured brief from wizard)
 * opts.projectId — used when saving
 */
export function planProject(brief, opts = {}) {
  const briefText = typeof brief === 'string' ? brief : JSON.stringify(brief);
  const complexity = assessComplexity(briefText);
  const teamBlueprint = buildTeamBlueprint(complexity, briefText);
  const workFramework = buildWorkFramework(complexity);

  return {
    plan_id: `cto_${Date.now()}`,
    created_at: new Date().toISOString(),
    project_id: opts.projectId || null,
    brief_summary: briefText.slice(0, 500),
    complexity,
    teamBlueprint,
    workFramework,
  };
}

// ── Storage ───────────────────────────────────────────────────────────────────

function projectDir(root, projectId) {
  return join(getProjectsDir(root), projectId);
}

/**
 * saveCTOPlan(root, projectId, plan) → void
 */
export function saveCTOPlan(root, projectId, plan) {
  const dir = projectDir(root, projectId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'cto-plan.json'), JSON.stringify({ ...plan, project_id: projectId }, null, 2), 'utf-8');
}

/**
 * loadCTOPlan(root, projectId) → CTOPlan | null
 */
export function loadCTOPlan(root, projectId) {
  const path = join(projectDir(root, projectId), 'cto-plan.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return null; }
}
