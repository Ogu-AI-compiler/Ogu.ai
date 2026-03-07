/**
 * Agent Executor — shared execution core for agent tasks.
 *
 * Called by:
 *   - agent-run.mjs (CLI: ogu agent:run)
 *   - agent-runtime.mjs (programmatic: executeAgentTask)
 *   - runner-worker.mjs (Kadima daemon dispatch)
 *
 * Pipeline:
 *   1. Resolve role + model from OrgSpec
 *   2. Check budget
 *   3. Evaluate governance policy
 *   4. Build InputEnvelope
 *   5. Call LLM (with retry + escalation)
 *   6. Parse response, write files
 *   7. Build OutputEnvelope
 *   8. Deduct budget
 *   9. Emit audit
 *
 * Returns: { success, status, taskId, tokensUsed, cost, durationMs, files, attempts, error? }
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { emitAudit } from './audit-emitter.mjs';
import { deductBudget, checkBudget } from './budget-tracker.mjs';
import { buildInputEnvelope } from '../../../contracts/envelopes/input.mjs';
import { buildOutputEnvelope } from '../../../contracts/envelopes/output.mjs';
import { evaluatePolicy } from './policy-engine.mjs';
import { getNextTier } from './model-router.mjs';
import { callLLM, calculateCost } from './llm-client.mjs';
import { buildPrompt } from './prompt-builder.mjs';
import { parseResponse } from './response-parser.mjs';
import { createSession, endSession } from './agent-identity.mjs';
import { resolveMarketplaceAgent, searchRelevantPatterns, postExecutionHooks, injectSkillsIntoSystemPrompt } from './marketplace-bridge.mjs';
import { searchMemory } from './semantic-memory.mjs';
import { preflightTaskSpec, runTaskGates, buildTaskFixNote, formatGateErrorsForFix } from './task-gates.mjs';
import { getRunnersDir, resolveOguPath } from './runtime-paths.mjs';

// ── Dependency artifact loader ────────────────────────────────────────────────

const DEP_FILE_CAP = 15000;    // max chars per file
const DEP_TOTAL_CAP = 50000;   // max chars across all deps

function buildTaskGateResults(gateCheck) {
  if (!gateCheck) return [];
  const results = [];
  const errors = gateCheck.errors || [];
  const warnings = gateCheck.warnings || [];
  const msg = errors.length > 0 ? errors.join('; ').slice(0, 2000) : undefined;
  results.push({
    gate: `task-${gateCheck.group || 'local'}`,
    passed: gateCheck.passed === true,
    message: msg,
  });
  if (warnings.length > 0) {
    results.push({
      gate: 'task-warnings',
      passed: true,
      message: warnings.join('; ').slice(0, 2000),
    });
  }
  return results;
}

/**
 * loadDependencyArtifacts(root, taskSpec, runnersDir) → [{ path, content, _isDepArtifact }]
 * Reads output files from dependent tasks and returns them for context injection.
 */
export function loadDependencyArtifacts(root, taskSpec, runnersDir) {
  const deps = taskSpec?.dependsOn || taskSpec?.depends_on || [];
  if (!taskSpec || !Array.isArray(deps) || deps.length === 0) {
    return [];
  }

  const artifacts = [];
  let totalChars = 0;

  for (const depId of deps) {
    if (totalChars >= DEP_TOTAL_CAP) break;

    // Try to load output envelope
    let filePaths = [];
    const outputPath = join(runnersDir, `${depId}.output.json`);
    if (existsSync(outputPath)) {
      try {
        const envelope = JSON.parse(readFileSync(outputPath, 'utf8'));
        if (Array.isArray(envelope.files)) {
          filePaths = envelope.files.map(f => f.path).filter(Boolean);
        }
      } catch { /* skip malformed envelope */ }
    }

    // Fall back to taskSpec.input_artifacts if no output envelope files
    if (filePaths.length === 0 && Array.isArray(taskSpec.input_artifacts)) {
      filePaths = taskSpec.input_artifacts;
    }

    for (const fp of filePaths) {
      if (totalChars >= DEP_TOTAL_CAP) break;
      const fullPath = join(root, fp);
      if (!existsSync(fullPath)) continue;
      try {
        let content = readFileSync(fullPath, 'utf8');
        if (content.length === 0) continue;
        if (content.length > DEP_FILE_CAP) {
          content = content.slice(0, DEP_FILE_CAP) + '\n[truncated]';
        }
        if (totalChars + content.length > DEP_TOTAL_CAP) {
          content = content.slice(0, DEP_TOTAL_CAP - totalChars) + '\n[truncated]';
        }
        totalChars += content.length;
        artifacts.push({ path: fp, content, _isDepArtifact: true });
      } catch { /* skip unreadable */ }
    }
  }

  return artifacts;
}

/**
 * Load OrgSpec from .ogu/OrgSpec.json.
 * OrgSpec is GLOBAL — lives in the main Kadima OS repo, not per-project.
 * Search order: OGU_MAIN_ROOT → project root → env fallback.
 */
function loadOrgSpec(root) {
  // 1. Check main repo root (global OrgSpec)
  const mainRoot = process.env.OGU_MAIN_ROOT;
  if (mainRoot) {
    const mainPath = resolveOguPath(mainRoot, 'OrgSpec.json');
    if (existsSync(mainPath)) {
      try { return JSON.parse(readFileSync(mainPath, 'utf8')); } catch { /* fall through */ }
    }
  }

  // 2. Check project root
  const localPath = resolveOguPath(root, 'OrgSpec.json');
  if (existsSync(localPath)) {
    try { return JSON.parse(readFileSync(localPath, 'utf8')); } catch { /* fall through */ }
  }

  // No fallback — OrgSpec is required
  return null;
}

/**
 * Find best role from OrgSpec.
 * Handles alias mapping between team-assembler role IDs and OrgSpec role IDs.
 */
const ROLE_ALIASES = {
  backend_engineer: 'backend-dev',
  frontend_engineer: 'frontend-dev',
  engineer: 'backend-dev',
  developer: 'backend-dev',
  doc: 'pm',
  product_manager: 'pm',
};

function findBestRole(orgSpec, roleId) {
  const roles = orgSpec.roles || [];
  if (roleId) {
    const exact = roles.find(r => r.roleId === roleId && r.enabled);
    if (exact) return exact;
    const alias = ROLE_ALIASES[roleId];
    if (alias) return roles.find(r => r.roleId === alias && r.enabled);
  }
  return roles.find(r => r.enabled);
}

/**
 * Find best model from OrgSpec for a given role and tier.
 */
function findBestModel(orgSpec, role, targetTier) {
  const minTier = targetTier || role.modelPreferences?.minimum || 'standard';
  const tierOrder = { fast: 0, standard: 1, advanced: 2, premium: 2 };
  const minTierNum = tierOrder[minTier] ?? 0;

  for (const provider of orgSpec.providers.filter(p => p.enabled !== false)) {
    const eligible = provider.models
      .filter(m => {
        if (targetTier) return m.tier === targetTier;
        return (tierOrder[m.tier] ?? 0) >= minTierNum;
      })
      .sort((a, b) => (a.costPer1kInput || 0) - (b.costPer1kInput || 0));

    if (eligible.length > 0) {
      return { provider: provider.id, model: eligible[0] };
    }
  }
  return null;
}

/**
 * Execute an agent task programmatically.
 *
 * @param {string} root — repo root path
 * @param {object} options
 * @param {string} options.featureSlug — feature slug
 * @param {string} options.taskId — task ID
 * @param {string} [options.roleId] — agent role (auto-detected if not provided)
 * @param {string} [options.tier] — model tier override
 * @param {boolean} [options.dryRun=false] — skip LLM call
 * @param {boolean} [options.simulate=false] — use simulated LLM response
 * @param {string} [options.riskTier] — risk tier override
 * @param {string[]} [options.touches] — files touched (for governance)
 * @param {object} [options.taskSpec] — task spec from Plan.json (name, description, output)
 * @param {object} [options.handoffContext] — context from upstream task
 * @returns {Promise<{success: boolean, status: string, taskId: string, tokensUsed: object, cost: number, durationMs: number, files: object[], attempts: number, error?: string}>}
 */
export async function executeAgentTaskCore(root, options) {
  const {
    featureSlug,
    taskId,
    roleId = null,
    tier: requestedTier = null,
    dryRun = false,
    simulate: simulateRequested = false,
    simulateFailure = 0,
    riskTier: riskOverride = null,
    touches = [],
    taskSpec = null,
    handoffContext = null,
    fixNote = null,
  } = options;
  const simulate = false;
  if (simulateRequested) {
    console.warn(`[runner] simulate requested for ${taskId} but disabled — forcing real API call`);
  }

  const startedAt = new Date().toISOString();
  const runnersDir = getRunnersDir(root);
  mkdirSync(runnersDir, { recursive: true });

  const baseTaskSpec = taskSpec || { id: taskId, name: taskId, touches };
  const preflightInput = { ...baseTaskSpec, touches: (touches && touches.length > 0) ? touches : (baseTaskSpec.touches || []) };
  const preflight = preflightTaskSpec(root, preflightInput);
  if (!preflight.ok) {
    emitAudit('runner.preflight_failed', {
      taskId, featureSlug, errors: preflight.errors,
    }, { feature: { slug: featureSlug, taskId } });
    return {
      success: false,
      status: 'preflight_failed',
      taskId,
      error: preflight.errors.join('; '),
      tokensUsed: {},
      cost: 0,
      durationMs: 0,
      files: [],
      attempts: 0,
    };
  }
  const effectiveTouches = preflight.touches || [];
  const taskContext = {
    ...baseTaskSpec,
    title: baseTaskSpec.title || baseTaskSpec.name || taskId,
    touches: effectiveTouches,
    group: preflight.group || baseTaskSpec.group,
  };

  // 1. Load OrgSpec
  const orgSpec = loadOrgSpec(root);
  if (!orgSpec) {
    return { success: false, status: 'no_orgspec', taskId, error: 'OrgSpec.json not found', tokensUsed: {}, cost: 0, durationMs: 0, files: [], attempts: 0 };
  }

  // 2. Find role
  const role = findBestRole(orgSpec, roleId);
  if (!role) {
    return { success: false, status: 'no_role', taskId, error: `No suitable role${roleId ? ` (requested: ${roleId})` : ''}`, tokensUsed: {}, cost: 0, durationMs: 0, files: [], attempts: 0 };
  }

  // 2b. Check marketplace for hired agent
  const marketplace = resolveMarketplaceAgent(root, {
    featureSlug,
    roleId: roleId || role?.roleId,
    phase: taskSpec?.phase,
  });

  let marketplaceAgentId = null;
  if (marketplace.found) {
    marketplaceAgentId = marketplace.agent.agent_id;
    role.capabilities = marketplace.skills;
    role._marketplaceSystemPrompt = marketplace.systemPrompt;
    role._marketplaceDNA = marketplace.dna;
  }

  // 3. Find model
  let currentTier = requestedTier;
  const routing = findBestModel(orgSpec, role, currentTier);
  if (!routing) {
    return { success: false, status: 'no_model', taskId, error: 'No suitable model found', tokensUsed: {}, cost: 0, durationMs: 0, files: [], attempts: 0 };
  }
  currentTier = routing.model.tier;

  // 4. Check budget
  const estimatedCost = (role.maxTokensPerTask / 1000) * (routing.model.costPer1kInput || 0.003);
  const budgetResult = checkBudget(role.maxTokensPerTask, estimatedCost);
  if (!budgetResult.allowed) {
    return { success: false, status: 'budget_exceeded', taskId, error: budgetResult.reason, tokensUsed: {}, cost: 0, durationMs: 0, files: [], attempts: 0 };
  }

  // 5. Governance check
  const riskTier = riskOverride || role.riskTier || 'medium';
  const policyResult = evaluatePolicy({
    featureSlug,
    taskName: taskId,
    riskTier,
    touches: effectiveTouches,
    roleId: role.roleId,
  });

  if (policyResult.decision === 'DENY') {
    emitAudit('governance.blocked', { feature: featureSlug, task: taskId, decision: 'DENY', reason: policyResult.reason });
    return { success: false, status: 'governance_denied', taskId, error: policyResult.reason, tokensUsed: {}, cost: 0, durationMs: 0, files: [], attempts: 0 };
  }

  if (policyResult.decision === 'REQUIRES_APPROVAL') {
    return { success: false, status: 'requires_approval', taskId, error: policyResult.reason, tokensUsed: {}, cost: 0, durationMs: 0, files: [], attempts: 0 };
  }

  // 5b. Create agent session (formal identity binding)
  let session = null;
  try {
    session = createSession({ roleId: role.roleId, featureSlug, taskId, root });
  } catch {
    // Session creation is best-effort — fall back to anonymous UUID
  }
  const sessionId = session?.sessionId || randomUUID();

  // 6. Build InputEnvelope
  const inputEnvelope = buildInputEnvelope({
    taskId,
    featureSlug,
    taskName: taskContext.title,
    agent: {
      roleId: role.roleId,
      sessionId,
      capabilities: role.capabilities,
    },
    prompt: taskSpec?.description || `Execute task "${taskId}" for feature "${featureSlug}".`,
    files: [],
    routingDecision: {
      provider: routing.provider,
      model: routing.model.id,
      tier: routing.model.tier,
      reason: `Best match for role "${role.roleId}"`,
      escalationChain: [],
    },
    budget: {
      maxTokens: role.maxTokensPerTask,
      maxCost: estimatedCost,
      remainingDaily: budgetResult.remaining,
      currency: 'USD',
    },
    sandboxPolicy: {
      allowedPaths: role.sandbox?.allowedPaths || ['src/**'],
      blockedPaths: role.sandbox?.blockedPaths || [],
      allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
      blockedTools: [],
      envFilter: [],
      networkAccess: role.sandbox?.networkAccess || 'none',
      networkAllowlist: [],
    },
    blastRadius: {
      allowed_write: role.sandbox?.allowedPaths || ['src/**'],
    },
  });

  if (handoffContext) inputEnvelope.handoffContext = handoffContext;

  writeFileSync(join(runnersDir, `${taskId}.input.json`), JSON.stringify(inputEnvelope, null, 2), 'utf8');

  emitAudit('runner.started', {
    taskId, featureSlug, agentRoleId: role.roleId,
    model: routing.model.id, dryRun,
  });

  // 7. Retry + Escalation Loop
  const escalation = orgSpec.escalation || { enabled: false, maxRetries: 0, tierOrder: ['fast', 'standard', 'advanced'] };
  const maxRetries = escalation.enabled ? (escalation.maxRetries || 2) : 0;
  let attempt = 0;
  let outputStatus = null;
  let tokensUsed = { input: 0, output: 0, total: 0 };
  let cost = 0;
  let filesProduced = [];
  let activeModel = routing.model;
  let activeProvider = routing.provider;
  let activeTier = currentTier;
  let activeFixNote = fixNote;
  let gateResults = [];
  let finalError = null;
  const shouldRunGates = !dryRun && !simulate && process.env.OGU_TASK_GATES !== '0';

  while (attempt <= maxRetries) {
    attempt++;

    if (dryRun) {
      // Simulate failure for retry/escalation testing
      if (simulateFailure > 0 && attempt <= simulateFailure) {
        emitAudit('agent.retry', {
          taskId, featureSlug, attempt, tier: activeTier,
          model: activeModel.id, error: 'simulated failure',
        });

        if (escalation.enabled && attempt <= maxRetries) {
          const nextTier = getNextTier(activeTier);
          if (nextTier) {
            const nextRouting = findBestModel(orgSpec, role, nextTier);
            if (nextRouting) {
              emitAudit('agent.escalation', {
                taskId, featureSlug,
                fromTier: activeTier, toTier: nextTier,
                fromModel: activeModel.id, toModel: nextRouting.model.id,
              });
              activeTier = nextTier;
              activeModel = nextRouting.model;
              activeProvider = nextRouting.provider;
            }
          }
          // Continue loop — retry at current or escalated tier
          continue;
        }

        // Exhausted retries — no more attempts left
        const durationMs = Date.now() - new Date(startedAt).getTime();
        emitAudit('agent.exhausted', { taskId, featureSlug, attempts: attempt, finalTier: activeTier, error: 'simulated failure exhausted' });
        return { success: false, status: 'exhausted', taskId, error: 'All retries and tiers exhausted (simulated failure)', tokensUsed, cost, durationMs, files: [], attempts: attempt };
      }

      // Dry-run: no LLM call
      outputStatus = 'success';
      tokensUsed = { input: 0, output: 0, total: 0 };
      cost = 0;
      break;
    }

    // Load Plan.json task spec for file outputs
    let simulateFiles = [];
    if (taskSpec?.output?.files) {
      simulateFiles = taskSpec.output.files.map(f => ({ path: f.path, content: f.content || '' }));
    } else {
      // Try loading from Plan.json on disk (04_Features path first, legacy fallback)
      const planPath = existsSync(join(root, `docs/vault/04_Features/${featureSlug}/Plan.json`))
        ? join(root, `docs/vault/04_Features/${featureSlug}/Plan.json`)
        : join(root, `docs/vault/features/${featureSlug}/Plan.json`);
      if (existsSync(planPath)) {
        try {
          const plan = JSON.parse(readFileSync(planPath, 'utf8'));
          const planTask = plan.tasks?.find(t => t.id === taskId);
          if (planTask?.output?.files) {
            simulateFiles = planTask.output.files.map(f => ({ path: f.path, content: f.content || '' }));
          }
        } catch { /* skip */ }
      }
    }

    // Build prompt — inject fix note for auto-fix context
    let taskDescription = taskSpec?.description || `Execute task "${taskId}"`;

    // Inject required file paths from touches — agent MUST create exactly these files
    const allTouches = effectiveTouches;
    if (allTouches.length > 0) {
      taskDescription += `\n\n--- REQUIRED FILES (CRITICAL — read carefully) ---\nYou MUST create ALL of the following files at EXACTLY these paths.\nDo NOT use different names, do NOT use different directories.\nThe gate validator checks for EXACT paths — any deviation will cause this task to FAIL.\n\n${allTouches.map(t => `- ${t}`).join('\n')}\n--- END REQUIRED FILES ---`;
    }

    // Inject done_when criteria
    if (taskContext?.done_when) {
      taskDescription += `\n\n--- ACCEPTANCE CRITERIA ---\n${taskContext.done_when}\n--- END ACCEPTANCE CRITERIA ---`;
    }

    // Inject gate validation rules so agent knows upfront what files must satisfy
    {
      const group = taskContext.group || 'core';
      const rules = [
        '- Every file must have real content (not empty, not just comments)',
        '- No TODO/FIXME/HACK comments in any file',
        '- All .json files must be valid JSON with at least one key',
      ];
      if (group === 'setup' || group === 'core' || group === 'integration') {
        rules.push('- Every .ts/.tsx/.js/.jsx file must export at least one symbol (use `export` or `export default`)');
        rules.push('- Config files using CommonJS: use `module.exports = { ... }` — this counts as an export');
      }
      if (group === 'ui') {
        rules.push('- Every .tsx/.jsx file must export a React component with a PascalCase name (e.g. `export default function MyComponent` or `export const MyComponent`)');
      }
      if (group === 'polish') {
        const hasCodeFiles = allTouches.some(t => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(t));
        if (hasCodeFiles) {
          rules.push('- Must include at least one test file (.test.ts, .spec.ts, .test.tsx etc.) with describe/it/test blocks');
        }
      }
      taskDescription += `\n\n--- FILE VALIDATION RULES (your output MUST satisfy ALL of these) ---\n${rules.join('\n')}\n--- END VALIDATION RULES ---`;
    }

    if (activeFixNote) {
      taskDescription += `\n\n--- AUTO-FIX CONTEXT ---\n${activeFixNote}\n--- END AUTO-FIX ---`;
    }

    // Load existing file contents as context (critical for fix mode)
    const contextFiles = [];
    if (activeFixNote && effectiveTouches.length > 0) {
      for (const touchPath of effectiveTouches) {
        const fullPath = join(root, touchPath);
        if (existsSync(fullPath)) {
          try {
            const content = readFileSync(fullPath, 'utf8');
            if (content.length > 0 && content.length < 20000) {
              contextFiles.push({ path: touchPath, content });
            }
          } catch { /* skip */ }
        }
      }
    }

    // In fix mode: auto-discover and load shared type definition files + error-referenced modules
    if (activeFixNote) {
      const loadedPaths = new Set(contextFiles.map(f => f.path));

      // 1. Common type definition patterns
      const typePatterns = [
        'src/types/index.ts', 'src/types.ts', 'src/store/types.ts', 'src/lib/types.ts',
        'src/store/todoStore.ts', 'src/stores/todoStore.ts',
        'src/store/index.ts', 'src/stores/index.ts',
        'src/store/hooks.ts', 'src/hooks/index.ts',
      ];

      // 2. Extract module paths mentioned in error text (e.g., '"@/store/hooks"', '"../types/index"')
      const moduleRefs = [...new Set(
        [...(activeFixNote.matchAll(/Module ['"]([^'"]+)['"]/g))].map(m => m[1])
          .concat([...(activeFixNote.matchAll(/from ['"]([^'"]+)['"]/g))].map(m => m[1]))
      )];
      for (const mod of moduleRefs) {
        // Resolve @/ alias to src/
        const resolved = mod.replace(/^@\//, 'src/');
        // Try common extensions
        for (const ext of ['.ts', '.tsx', '/index.ts', '.js']) {
          typePatterns.push(resolved + ext);
        }
      }

      for (const tp of typePatterns) {
        if (loadedPaths.has(tp)) continue;
        const fullPath = join(root, tp);
        if (existsSync(fullPath)) {
          try {
            const content = readFileSync(fullPath, 'utf8');
            if (content.length > 0 && content.length < 20000) {
              contextFiles.push({ path: tp, content });
              loadedPaths.add(tp);
            }
          } catch { /* skip */ }
        }
      }
    }

    // Load dependency artifacts from upstream tasks
    const depArtifacts = loadDependencyArtifacts(root, taskSpec, runnersDir);
    if (depArtifacts.length > 0) {
      depArtifacts[0]._sectionHeader = '## Dependency Artifacts';
      contextFiles.push(...depArtifacts);
    }

    // Load architecture docs (Invariants + Default_Stack) for all runs
    const archDir = join(root, 'docs/vault/01_Architecture');
    for (const archDoc of ['Invariants.md', 'Default_Stack.md']) {
      const archPath = join(archDir, archDoc);
      if (existsSync(archPath)) {
        try {
          const content = readFileSync(archPath, 'utf8');
          if (content.trim().length > 50) {
            contextFiles.push({ path: `docs/vault/01_Architecture/${archDoc}`, content });
          }
        } catch { /* skip */ }
      }
    }

    // Load feature-specific docs (Spec.md, DESIGN.md, PRD.md)
    const featureDir = existsSync(join(root, `docs/vault/04_Features/${featureSlug}`))
      ? join(root, `docs/vault/04_Features/${featureSlug}`)
      : join(root, `docs/vault/features/${featureSlug}`);
    for (const featureDoc of ['Spec.md', 'DESIGN.md', 'PRD.md']) {
      const docPath = join(featureDir, featureDoc);
      if (existsSync(docPath)) {
        try {
          const content = readFileSync(docPath, 'utf8');
          if (content.trim().length > 50) {
            contextFiles.push({ path: `docs/vault/features/${featureSlug}/${featureDoc}`, content });
          }
        } catch { /* skip */ }
      }
    }

    // Search for relevant learned patterns from marketplace
    const patternSection = searchRelevantPatterns(root, {
      taskType: taskSpec?.name || taskId,
      featureSlug,
    });

    const patternEntities = patternSection
      ? [{ type: 'learned-pattern', title: 'Marketplace Patterns', content: patternSection }]
      : [];

    // Search semantic memory for broad project knowledge (ADRs, decisions, docs)
    let memoryEntities = [];
    try {
      const memoryResults = searchMemory({
        root,
        tags: [featureSlug, role.roleId, taskContext.group].filter(Boolean),
        query: taskSpec?.name || taskId,
        category: 'pattern',
        limit: 5,
      });
      if (memoryResults.length > 0) {
        const content = memoryResults.map(e => `- ${e.content}`).join('\n');
        memoryEntities = [{ type: 'semantic-memory', title: 'Project Context', content }];
      }
    } catch { /* semantic memory is optional */ }

    let handoffEntities = [];
    try {
      if (handoffContext && Object.keys(handoffContext).length > 0) {
        const raw = JSON.stringify(handoffContext, null, 2);
        const content = raw.length > 12000 ? raw.slice(0, 12000) + '\n[truncated]' : raw;
        handoffEntities = [{ type: 'handoff-context', title: 'Upstream Task Handoff', content }];
      }
    } catch { /* best-effort */ }

    // Inject per-task skill context into marketplace agent system prompt (lazy loading)
    let taskSystemPrompt = role._marketplaceSystemPrompt || null;
    if (taskSystemPrompt && marketplace.agent) {
      taskSystemPrompt = injectSkillsIntoSystemPrompt(taskSystemPrompt, marketplace.agent, taskDescription);
    }

    const promptData = buildPrompt({
      role: role.roleId,
      taskName: taskContext.title,
      taskDescription,
      featureSlug,
      files: simulateFiles.map(f => ({ path: f.path, role: 'write' })),
      contextFiles,
      entities: [...patternEntities, ...memoryEntities, ...handoffEntities],
      systemPromptOverride: taskSystemPrompt,
    });

    try {
      // Call LLM
      const llmResponse = await callLLM({
        provider: activeProvider,
        model: activeModel.id,
        messages: promptData.messages,
        system: promptData.system,
        maxTokens: role.maxTokensPerTask || 4096,
        temperature: 0,
        simulate,
        simulateFiles,
      });

      // Parse response
      const parsed = parseResponse(llmResponse, {
        costPer1kInput: activeModel.costPer1kInput,
        costPer1kOutput: activeModel.costPer1kOutput,
      });

      // Write files to disk
      for (const file of parsed.files) {
        const fullPath = join(root, file.path);
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, file.content, 'utf8');

        // Clean stale .js shadow when writing .ts/.tsx
        if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
          const base = fullPath.replace(/\.tsx?$/, '');
          const jsPath = base + '.js';
          if (existsSync(jsPath)) {
            try { const { unlinkSync: ul } = await import('node:fs'); ul(jsPath); } catch { /* skip */ }
          }
        }
      }

      tokensUsed = parsed.tokensUsed;
      cost = parsed.cost;
      filesProduced = parsed.files;

      if (shouldRunGates) {
        const gateCheck = await runTaskGates(root, taskContext, { runTests: true });
        gateResults = buildTaskGateResults(gateCheck);

        if (!gateCheck.passed) {
          const rawError = formatGateErrorsForFix(gateCheck.errors || []);
          activeFixNote = buildTaskFixNote(taskContext, { errors: gateCheck.errors || [], rawError }, root);

          emitAudit('agent.retry', {
            taskId, featureSlug, attempt, tier: activeTier,
            model: activeModel.id, error: rawError.slice(0, 400), gateFailed: true,
          });

          if (escalation.enabled && attempt <= maxRetries) {
            const nextTier = getNextTier(activeTier);
            if (nextTier) {
              const nextRouting = findBestModel(orgSpec, role, nextTier);
              if (nextRouting) {
                emitAudit('agent.escalation', {
                  taskId, featureSlug,
                  fromTier: activeTier, toTier: nextTier,
                  fromModel: activeModel.id, toModel: nextRouting.model.id,
                });
                activeTier = nextTier;
                activeModel = nextRouting.model;
                activeProvider = nextRouting.provider;
              }
            }
          }

          if (attempt <= maxRetries) {
            continue;
          }

          outputStatus = 'validation_failed';
          finalError = rawError;
          break;
        }
      }

      outputStatus = 'success';
      break;

    } catch (err) {
      // LLM call failed — try escalation
      emitAudit('agent.retry', {
        taskId, featureSlug, attempt, tier: activeTier,
        model: activeModel.id, error: err.message,
      });

      if (escalation.enabled && attempt <= maxRetries) {
        const nextTier = getNextTier(activeTier);
        if (nextTier) {
          const nextRouting = findBestModel(orgSpec, role, nextTier);
          if (nextRouting) {
            emitAudit('agent.escalation', {
              taskId, featureSlug,
              fromTier: activeTier, toTier: nextTier,
              fromModel: activeModel.id, toModel: nextRouting.model.id,
            });
            activeTier = nextTier;
            activeModel = nextRouting.model;
            activeProvider = nextRouting.provider;
            continue;
          }
        }
      }

      // Exhausted retries
      const durationMs = Date.now() - new Date(startedAt).getTime();
      if (marketplaceAgentId) {
        try { postExecutionHooks(root, { agentId: marketplaceAgentId, taskId, featureSlug, success: false, iterationCount: attempt, gateFailed: false, durationMs }); } catch { /* best-effort */ }
      }
      emitAudit('agent.exhausted', { taskId, featureSlug, attempts: attempt, finalTier: activeTier, error: err.message });
      return { success: false, status: 'exhausted', taskId, error: err.message, tokensUsed, cost, durationMs, files: [], attempts: attempt };
    }
  }

  // 8. Build OutputEnvelope
  const completedAt = new Date().toISOString();
  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

  const outputEnvelope = buildOutputEnvelope(taskId, {
    status: outputStatus,
    files: filesProduced.map(f => ({ path: f.path, action: 'created', linesAdded: (f.content || '').split('\n').length })),
    tokensUsed: { ...tokensUsed, cost, currency: 'USD' },
    gateResults,
    error: finalError ? { code: 'OGU-GATE', message: finalError } : undefined,
  }, {
    featureSlug,
    pid: process.pid,
    isolationLevel: 'L0',
    durationMs,
    startedAt,
    idempotencyKey: inputEnvelope.idempotencyKey,
  });

  writeFileSync(join(runnersDir, `${taskId}.output.json`), JSON.stringify(outputEnvelope, null, 2), 'utf8');

  // 9. Deduct budget
  deductBudget({
    featureSlug,
    taskId,
    agentRoleId: role.roleId,
    model: activeModel.id,
    provider: activeProvider,
    inputTokens: tokensUsed.input,
    outputTokens: tokensUsed.output,
    cost,
  });

  // 10. End agent session
  if (session?.sessionId) {
    try { endSession({ sessionId: session.sessionId, status: outputStatus, root }); } catch { /* best-effort */ }
  }

  // 11. Marketplace post-execution hooks
  if (marketplaceAgentId) {
    try {
      postExecutionHooks(root, {
        agentId: marketplaceAgentId,
        taskId, featureSlug,
        success: outputStatus === 'success',
        iterationCount: attempt,
        gateFailed: outputStatus !== 'success',
        durationMs,
      });
    } catch { /* best-effort */ }
  }

  // 12. Emit completion audit
  emitAudit('runner.completed', {
    taskId, featureSlug, status: outputStatus,
    tokensUsed: tokensUsed.total, cost, durationMs,
    dryRun, model: activeModel.id, tier: activeTier, attempts: attempt,
  });

  return {
    success: outputStatus === 'success',
    status: outputStatus,
    taskId,
    roleId: role.roleId,
    model: activeModel.id,
    tier: activeTier,
    tokensUsed,
    cost,
    durationMs,
    files: filesProduced,
    attempts: attempt,
    error: finalError || undefined,
  };
}
