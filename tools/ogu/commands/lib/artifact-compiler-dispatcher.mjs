/**
 * artifact-compiler-dispatcher.mjs
 * Routes agent-produced output to the matching artifact compiler.
 *
 * Two phases:
 *   1. detectCompiler(agentSkills, taskDescription, filesProduced) → CompilerInfo | null
 *   2. runArtifactCompiler(root, compilerInfo, { filesProduced, projectRoot }) → CompilerResult
 *
 * CompilerInfo: { skill, category, dir, runnerPath }
 * CompilerResult: { success, skill, compiler, gates, failures, elapsed_ms, skipped }
 */

import { existsSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));

// Root of the artifact compilers directory
const COMPILERS_ROOT = join(__dir, '..', '..', 'compilers');

// ── Skill → Compiler mapping ──────────────────────────────────────────────────
// Maps skill slug → { category, dir }
// DevOps dirs use underscores; all others use hyphens.

const SKILL_TO_COMPILER = {
  // Backend
  'api-route':                    { category: 'backend',        dir: 'api-route' },
  'auth-middleware':               { category: 'backend',        dir: 'auth-middleware' },
  'backend-test-harness-config':   { category: 'backend',        dir: 'backend-test-harness-config' },
  'backend-test-module':           { category: 'backend',        dir: 'backend-test-module' },
  'cache-module':                  { category: 'backend',        dir: 'cache-module' },
  'cache-topology-module':         { category: 'backend',        dir: 'cache-topology-module' },
  'config-validation-module':      { category: 'backend',        dir: 'config-validation-module' },
  'db-migration':                  { category: 'backend',        dir: 'db-migration' },
  'domain-service-module':         { category: 'backend',        dir: 'domain-service-module' },
  'event-consumer-module':         { category: 'backend',        dir: 'event-consumer-module' },
  'event-publisher-module':        { category: 'backend',        dir: 'event-publisher-module' },
  'graphql-resolver-module':       { category: 'backend',        dir: 'graphql-resolver-module' },
  'graphql-schema-module':         { category: 'backend',        dir: 'graphql-schema-module' },
  'healthcheck-module':            { category: 'backend',        dir: 'healthcheck-module' },
  'job-producer-module':           { category: 'backend',        dir: 'job-producer-module' },
  'job-worker-module':             { category: 'backend',        dir: 'job-worker-module' },
  'module-scaffold':               { category: 'backend',        dir: 'module-scaffold' },
  'openapi-spec':                  { category: 'backend',        dir: 'openapi-spec' },
  'orm-repository-module':         { category: 'backend',        dir: 'orm-repository-module' },
  'queue-topology-module':         { category: 'backend',        dir: 'queue-topology-module' },
  'rate-limit-policy-module':      { category: 'backend',        dir: 'rate-limit-policy-module' },
  'scheduled-job-module':          { category: 'backend',        dir: 'scheduled-job-module' },
  'seed-scenario-module':          { category: 'backend',        dir: 'seed-scenario-module' },
  'service-client-module':         { category: 'backend',        dir: 'service-client-module' },
  'service-client-runtime-module': { category: 'backend',        dir: 'service-client-runtime-module' },
  'transaction-script-module':     { category: 'backend',        dir: 'transaction-script-module' },
  'ts-schema':                     { category: 'backend',        dir: 'ts-schema' },
  'webhook-processor-module':      { category: 'backend',        dir: 'webhook-processor-module' },

  // Frontend
  'a11y-harness-config':           { category: 'frontend',       dir: 'a11y-harness-config' },
  'animation-spec':                { category: 'frontend',       dir: 'animation-spec' },
  'design-tokens':                 { category: 'frontend',       dir: 'design-tokens' },
  'error-boundary-wrapper':        { category: 'frontend',       dir: 'error-boundary-wrapper' },
  'experiment-variant-wrapper':    { category: 'frontend',       dir: 'experiment-variant-wrapper' },
  'feature-module-scaffold':       { category: 'frontend',       dir: 'feature-module-scaffold' },
  'invalidation-map':              { category: 'frontend',       dir: 'invalidation-map' },
  'layout-component':              { category: 'frontend',       dir: 'layout-component' },
  'loading-skeleton':              { category: 'frontend',       dir: 'loading-skeleton' },
  'mutation-module':               { category: 'frontend',       dir: 'mutation-module' },
  'navigation-config':             { category: 'frontend',       dir: 'navigation-config' },
  'providers-scaffold':            { category: 'frontend',       dir: 'providers-scaffold' },
  'query-module':                  { category: 'frontend',       dir: 'query-module' },
  'react-component':               { category: 'frontend',       dir: 'react-component' },
  'react-form':                    { category: 'frontend',       dir: 'react-form' },
  'react-hook':                    { category: 'frontend',       dir: 'react-hook' },
  'react-page':                    { category: 'frontend',       dir: 'react-page' },
  'route-guard':                   { category: 'frontend',       dir: 'route-guard' },
  'route-resilience':              { category: 'frontend',       dir: 'route-resilience' },
  'routing-config':                { category: 'frontend',       dir: 'routing-config' },
  'security-safe-html-module':     { category: 'frontend',       dir: 'security-safe-html-module' },
  'state-store':                   { category: 'frontend',       dir: 'state-store' },
  'storybook-harness-config':      { category: 'frontend',       dir: 'storybook-harness-config' },
  'storybook-story':               { category: 'frontend',       dir: 'storybook-story' },
  'swr-resource-module':           { category: 'frontend',       dir: 'swr-resource-module' },
  'testing-harness-config':        { category: 'frontend',       dir: 'testing-harness-config' },
  'ui-color-system':               { category: 'frontend',       dir: 'ui-color-system' },
  'ui-component-variant':          { category: 'frontend',       dir: 'ui-component-variant' },
  'ui-motion-spec':                { category: 'frontend',       dir: 'ui-motion-spec' },
  'ui-spacing-scale':              { category: 'frontend',       dir: 'ui-spacing-scale' },
  'ui-state-appearance':           { category: 'frontend',       dir: 'ui-state-appearance' },
  'ui-theme-manifest':             { category: 'frontend',       dir: 'ui-theme-manifest' },
  'ui-token-system':               { category: 'frontend',       dir: 'ui-token-system' },
  'ui-typography-scale':           { category: 'frontend',       dir: 'ui-typography-scale' },
  'unit-test-module':              { category: 'frontend',       dir: 'unit-test-module' },
  'url-searchparams-contract':     { category: 'frontend',       dir: 'url-searchparams-contract' },

  // QA
  'accessibility-policy':          { category: 'qa',             dir: 'accessibility-policy' },
  'contract-test':                 { category: 'qa',             dir: 'contract-test' },
  'coverage-policy':               { category: 'qa',             dir: 'coverage-policy' },
  'e2e-spec':                      { category: 'qa',             dir: 'e2e-spec' },
  'load-test-spec':                { category: 'qa',             dir: 'load-test-spec' },
  'performance-budget':            { category: 'qa',             dir: 'performance-budget' },
  'test-data-policy':              { category: 'qa',             dir: 'test-data-policy' },
  'test-harness-config':           { category: 'qa',             dir: 'test-harness-config' },
  'visual-regression':             { category: 'qa',             dir: 'visual-regression' },

  // Security
  'audit-log-policy':              { category: 'security',       dir: 'audit-log-policy' },
  'authz-policy':                  { category: 'security',       dir: 'authz-policy' },
  'csp-policy':                    { category: 'security',       dir: 'csp-policy' },
  'dep-vuln-policy':               { category: 'security',       dir: 'dep-vuln-policy' },
  'encryption-key-policy':         { category: 'security',       dir: 'encryption-key-policy' },
  'file-upload-policy':            { category: 'security',       dir: 'file-upload-policy' },
  'input-validation-policy':       { category: 'security',       dir: 'input-validation-policy' },
  'pii-classification':            { category: 'security',       dir: 'pii-classification' },
  'rate-limit-policy':             { category: 'security',       dir: 'rate-limit-policy' },
  'sast-policy':                   { category: 'security',       dir: 'sast-policy' },
  'secret-handling-policy':        { category: 'security',       dir: 'secret-handling-policy' },
  'session-cookie-policy':         { category: 'security',       dir: 'session-cookie-policy' },
  'threat-model':                  { category: 'security',       dir: 'threat-model' },
  'vuln-exception-record':         { category: 'security',       dir: 'vuln-exception-record' },
  'webhook-verification-policy':   { category: 'security',       dir: 'webhook-verification-policy' },

  // DevOps — directory names use underscores
  'background-worker-runtime':     { category: 'devops',         dir: 'background_worker_runtime' },
  'backup-verification-job':       { category: 'devops',         dir: 'backup_verification_job' },
  'ci-cd-pipeline':                { category: 'devops',         dir: 'ci_cd_pipeline' },
  'connection-pool-config':        { category: 'devops',         dir: 'connection_pool_config' },
  'cost-tagging-policy':           { category: 'devops',         dir: 'cost_tagging_policy' },
  'data-seed-job':                 { category: 'devops',         dir: 'data_seed_job' },
  'db-backup-job':                 { category: 'devops',         dir: 'db_backup_job' },
  'db-migration-runner':           { category: 'devops',         dir: 'db_migration_runner' },
  'developer-platform-stack':      { category: 'devops',         dir: 'developer_platform_stack' },
  'disaster-recovery-runbook':     { category: 'devops',         dir: 'disaster_recovery_runbook' },
  'dockerfile-image':              { category: 'devops',         dir: 'dockerfile_image' },
  'edge-policy-bundle':            { category: 'devops',         dir: 'edge_policy_bundle' },
  'env-schema':                    { category: 'devops',         dir: 'env_schema' },
  'grafana-dashboard-bundle':      { category: 'devops',         dir: 'grafana_dashboard_bundle' },
  'healthcheck-probe-config':      { category: 'devops',         dir: 'healthcheck_probe_config' },
  'helm-chart':                    { category: 'devops',         dir: 'helm_chart' },
  'iac-stack-definition':          { category: 'devops',         dir: 'iac_stack_definition' },
  'kubernetes-ingress-gateway':    { category: 'devops',         dir: 'kubernetes_ingress_gateway' },
  'kubernetes-service':            { category: 'devops',         dir: 'kubernetes_service' },
  'kubernetes-workload':           { category: 'devops',         dir: 'kubernetes_workload' },
  'kustomize-overlay':             { category: 'devops',         dir: 'kustomize_overlay' },
  'network-dns-config':            { category: 'devops',         dir: 'network_dns_config' },
  'prometheus-rule-group':         { category: 'devops',         dir: 'prometheus_rule_group' },
  'rightsizing-profile':           { category: 'devops',         dir: 'rightsizing_profile' },
  'scheduled-job':                 { category: 'devops',         dir: 'scheduled_job' },
  'secret-bundle':                 { category: 'devops',         dir: 'secret_bundle' },
  'security-scan-pipeline':        { category: 'devops',         dir: 'security_scan_pipeline' },
  'vault-policy':                  { category: 'devops',         dir: 'vault_policy' },

  // UX
  'ux-copy-structure':             { category: 'ux',             dir: 'ux-copy-structure' },
  'ux-data-table-model':           { category: 'ux',             dir: 'ux-data-table-model' },
  'ux-destructive-action':         { category: 'ux',             dir: 'ux-destructive-action' },
  'ux-experiment-variant-flow':    { category: 'ux',             dir: 'ux-experiment-variant-flow' },
  'ux-form-flow':                  { category: 'ux',             dir: 'ux-form-flow' },
  'ux-navigation-graph':           { category: 'ux',             dir: 'ux-navigation-graph' },
  'ux-onboarding-flow':            { category: 'ux',             dir: 'ux-onboarding-flow' },
  'ux-permission-branch':          { category: 'ux',             dir: 'ux-permission-branch' },
  'ux-recovery-flow':              { category: 'ux',             dir: 'ux-recovery-flow' },
  'ux-responsive-structure':       { category: 'ux',             dir: 'ux-responsive-structure' },
  'ux-rtl-structure':              { category: 'ux',             dir: 'ux-rtl-structure' },
  'ux-search-filter-sort':         { category: 'ux',             dir: 'ux-search-filter-sort' },
  'ux-sitemap':                    { category: 'ux',             dir: 'ux-sitemap' },
  'ux-state-matrix':               { category: 'ux',             dir: 'ux-state-matrix' },
  'ux-task-flow':                  { category: 'ux',             dir: 'ux-task-flow' },
  'ux-user-flow':                  { category: 'ux',             dir: 'ux-user-flow' },

  // Data Science
  'ab-test-analysis':              { category: 'data-science',   dir: 'ab-test-analysis' },
  'data-ingestion-script':         { category: 'data-science',   dir: 'data-ingestion-script' },
  'data-pipeline-script':          { category: 'data-science',   dir: 'data-pipeline-script' },
  'data-schema':                   { category: 'data-science',   dir: 'data-schema' },
  'data-validation-module':        { category: 'data-science',   dir: 'data-validation-module' },
  'dataset-split-module':          { category: 'data-science',   dir: 'dataset-split-module' },
  'eda-notebook':                  { category: 'data-science',   dir: 'eda-notebook' },
  'experiment-config':             { category: 'data-science',   dir: 'experiment-config' },
  'feature-pipeline':              { category: 'data-science',   dir: 'feature-pipeline' },
  'feature-store-module':          { category: 'data-science',   dir: 'feature-store-module' },
  'jupyter-notebook-module':       { category: 'data-science',   dir: 'jupyter-notebook-module' },
  'model-card':                    { category: 'data-science',   dir: 'model-card' },
  'model-evaluation-report':       { category: 'data-science',   dir: 'model-evaluation-report' },
  'model-monitoring-config':       { category: 'data-science',   dir: 'model-monitoring-config' },
  'model-registry-entry':          { category: 'data-science',   dir: 'model-registry-entry' },
  'model-training-script':         { category: 'data-science',   dir: 'model-training-script' },
  'serving-api-module':            { category: 'data-science',   dir: 'serving-api-module' },
  'statistical-test-module':       { category: 'data-science',   dir: 'statistical-test-module' },

  // Database Admin
  'backup-policy':                 { category: 'database-admin', dir: 'backup-policy' },
  'connection-pool-config':        { category: 'database-admin', dir: 'connection-pool-config' },
  'connection-string-contract':    { category: 'database-admin', dir: 'connection-string-contract' },
  'db-provisioning-spec':          { category: 'database-admin', dir: 'db-provisioning-spec' },
  'index-advisory-spec':           { category: 'database-admin', dir: 'index-advisory-spec' },
  'query-performance-budget':      { category: 'database-admin', dir: 'query-performance-budget' },
  'restore-verification-spec':     { category: 'database-admin', dir: 'restore-verification-spec' },
  'role-privilege-policy':         { category: 'database-admin', dir: 'role-privilege-policy' },

  // Content
  'alt-text-policy':               { category: 'content',        dir: 'alt-text-policy' },
  'content-type-schema':           { category: 'content',        dir: 'content-type-schema' },
  'media-caption-credit-policy':   { category: 'content',        dir: 'media-caption-credit-policy' },
  'publishing-workflow-spec':      { category: 'content',        dir: 'publishing-workflow-spec' },
  'redirect-manifest':             { category: 'content',        dir: 'redirect-manifest' },
  'seo-metadata-spec':             { category: 'content',        dir: 'seo-metadata-spec' },
  'taxonomy-tagging-policy':       { category: 'content',        dir: 'taxonomy-tagging-policy' },

  // Shared
  'a11y-test':                     { category: 'shared',         dir: 'a11y-test' },
  'analytics-event':               { category: 'shared',         dir: 'analytics-event' },
  'feature-flag':                  { category: 'shared',         dir: 'feature-flag' },
  'i18n':                          { category: 'shared',         dir: 'i18n' },
  'utility-fn':                    { category: 'shared',         dir: 'utility-fn' },
};

// ── Compiler detection ────────────────────────────────────────────────────────

/**
 * scoreSkillForTask(skill, taskText) → number
 * Higher score = more relevant.
 */
function scoreSkillForTask(skill, taskText) {
  if (!skill || !taskText) return 0;
  const text = taskText.toLowerCase();
  let score = 0;

  // Exact slug match
  if (text.includes(skill)) score += 10;

  // Individual word matches
  for (const word of skill.split('-')) {
    if (word.length > 3 && text.includes(word)) score += 2;
  }
  return score;
}

/**
 * detectCompiler(agentSkills, taskDescription, filesProduced?) → CompilerInfo | null
 *
 * Picks the best artifact compiler for this task based on:
 * 1. Score each skill the agent has against the task description
 * 2. Return the highest-scoring skill that has a compiler entry
 *
 * agentSkills: string[] — skill slugs from the agent's skills array
 * taskDescription: string
 * filesProduced: [{ path, content }] — optional, used as secondary hint
 */
export function detectCompiler(agentSkills, taskDescription, filesProduced = []) {
  if (!Array.isArray(agentSkills) || agentSkills.length === 0) return null;

  const text = [
    taskDescription || '',
    ...filesProduced.map(f => f.path || ''),
  ].join(' ');

  let bestSkill = null;
  let bestScore = 0;

  for (const skill of agentSkills) {
    if (!SKILL_TO_COMPILER[skill]) continue;
    const score = scoreSkillForTask(skill, text);
    if (score > bestScore) {
      bestScore = score;
      bestSkill = skill;
    }
  }

  if (!bestSkill) {
    // Fallback: first agent skill that has a compiler entry
    bestSkill = agentSkills.find(s => SKILL_TO_COMPILER[s]) || null;
  }

  if (!bestSkill) return null;

  const { category, dir } = SKILL_TO_COMPILER[bestSkill];
  const runnerPath = join(COMPILERS_ROOT, category, dir, 'runner.mjs');

  if (!existsSync(runnerPath)) return null;

  return { skill: bestSkill, category, dir, runnerPath };
}

// ── Name inference ────────────────────────────────────────────────────────────

/**
 * inferArtifactName(filesProduced, taskDescription) → string
 * Derives a reasonable artifact name from produced files or task description.
 */
function inferArtifactName(filesProduced, taskDescription) {
  if (filesProduced.length > 0) {
    const firstFile = filesProduced[0].path || '';
    const base = basename(firstFile, extname(firstFile));
    if (base && base !== 'index') return base;
  }

  // Fall back to first PascalCase word from task description
  if (taskDescription) {
    const match = taskDescription.match(/\b([A-Z][a-zA-Z0-9]+)\b/);
    if (match) return match[1];
    // Or first significant word
    const word = taskDescription.split(/\s+/).find(w => w.length > 3);
    if (word) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }

  return 'Artifact';
}

// ── Compiler execution ────────────────────────────────────────────────────────

/**
 * runArtifactCompiler(root, compilerInfo, opts) → CompilerResult
 *
 * Dynamically imports the runner.mjs and calls the appropriate export.
 * Handles both runner interfaces:
 *   - runCompiler({ dir, name, projectRoot, options }) — frontend/backend
 *   - run({ dir, verbose })                            — security/devops/content/db-admin
 *
 * @param {string}  root          — project root
 * @param {object}  compilerInfo  — { skill, category, dir, runnerPath }
 * @param {object}  opts
 * @param {Array}   opts.filesProduced  — [{ path, content }]
 * @param {string}  [opts.taskDescription]
 * @param {boolean} [opts.skipTests]    — skip test-heavy gates
 * @param {boolean} [opts.verbose]      — verbose gate output
 *
 * @returns {Promise<CompilerResult>}
 */
export async function runArtifactCompiler(root, compilerInfo, opts = {}) {
  const { skill, runnerPath } = compilerInfo;
  const { filesProduced = [], taskDescription = '', skipTests = true, verbose = false } = opts;

  // Compute artifact dir — first file's parent directory
  let artifactDir = root;
  if (filesProduced.length > 0) {
    const firstRelPath = filesProduced[0].path || '';
    if (firstRelPath) {
      artifactDir = dirname(join(root, firstRelPath));
    }
  }

  const artifactName = inferArtifactName(filesProduced, taskDescription);

  try {
    const mod = await import(runnerPath);

    let result;
    if (typeof mod.runCompiler === 'function') {
      // Frontend / Backend interface
      result = await mod.runCompiler({
        dir: artifactDir,
        name: artifactName,
        projectRoot: root,
        options: { skipTests },
        onProgress: verbose ? (g) => {
          const icon = g.skipped ? '⏭' : g.pass ? '✓' : '✗';
          process.stderr.write(`  ${icon} [${skill}] ${g.id}: ${g.message || ''}\n`);
        } : undefined,
      });
    } else if (typeof mod.run === 'function') {
      // Security / DevOps / Content / DB-admin interface
      result = await mod.run({ dir: artifactDir, verbose });
    } else {
      return { success: false, skill, skipped: true, reason: 'no-runner-export', failures: [] };
    }

    // Normalise result shape across both interfaces
    const success = result?.success ?? (result?.pass ?? false);
    const failures = result?.failures
      || (result?.gates || []).filter(g => !g.pass && !g.skipped)
      || [];

    return {
      success,
      skill,
      compiler: result?.compiler || skill,
      category: compilerInfo.category,
      dir: artifactDir,
      gates: result?.gate_results || result?.gates || [],
      failures,
      elapsed_ms: result?.elapsed_ms || 0,
      artifact: result?.artifact || null,
    };
  } catch (err) {
    return {
      success: false,
      skill,
      compiler: skill,
      category: compilerInfo.category,
      dir: artifactDir,
      gates: [],
      failures: [{ id: 'runner-error', pass: false, message: err.message }],
      elapsed_ms: 0,
      error: err.message,
    };
  }
}

// ── Full dispatch ─────────────────────────────────────────────────────────────

/**
 * dispatchArtifactCompiler(root, opts) → CompilerResult | null
 *
 * Detects the best compiler for the task and runs it.
 * Returns null if no compiler can be detected (not an error — task may not map to one).
 *
 * @param {string}   root
 * @param {object}   opts
 * @param {string[]} opts.agentSkills      — agent's skill slugs
 * @param {Array}    opts.filesProduced    — [{ path, content }]
 * @param {string}   [opts.taskDescription]
 * @param {boolean}  [opts.skipTests]
 * @param {boolean}  [opts.verbose]
 */
export async function dispatchArtifactCompiler(root, opts = {}) {
  const { agentSkills = [], filesProduced = [], taskDescription = '', skipTests = true, verbose = false } = opts;

  const compilerInfo = detectCompiler(agentSkills, taskDescription, filesProduced);
  if (!compilerInfo) return null;

  return runArtifactCompiler(root, compilerInfo, { filesProduced, taskDescription, skipTests, verbose });
}

/**
 * buildArtifactCompilerError(result) → string
 * Formats compiler gate failures into a human-readable fix note.
 */
export function buildArtifactCompilerError(result) {
  if (!result || result.success) return '';
  const lines = [`Artifact compiler [${result.skill}] failed:`];
  for (const f of result.failures || []) {
    lines.push(`  ✗ [${f.code || f.id || 'gate'}] ${f.message || ''}`);
    if (f.detail) lines.push(`    ${String(f.detail).slice(0, 200)}`);
  }
  return lines.join('\n');
}
