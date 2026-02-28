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

/**
 * Load OrgSpec from .ogu/OrgSpec.json.
 */
function loadOrgSpec(root) {
  const path = join(root, '.ogu/OrgSpec.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Find best role from OrgSpec.
 */
function findBestRole(orgSpec, roleId) {
  if (roleId) return orgSpec.roles.find(r => r.roleId === roleId && r.enabled);
  return orgSpec.roles.find(r => r.enabled);
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
    simulate = false,
    simulateFailure = 0,
    riskTier: riskOverride = null,
    touches = [],
    taskSpec = null,
    handoffContext = null,
  } = options;

  const startedAt = new Date().toISOString();
  const runnersDir = join(root, '.ogu/runners');
  mkdirSync(runnersDir, { recursive: true });

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
    touches: touches || [],
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
    taskName: taskSpec?.name || taskId,
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
      // Try loading from Plan.json on disk
      const planPath = join(root, `docs/vault/features/${featureSlug}/Plan.json`);
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

    // Build prompt
    const promptData = buildPrompt({
      role: role.roleId,
      taskName: taskSpec?.name || taskId,
      taskDescription: taskSpec?.description || `Execute task "${taskId}"`,
      featureSlug,
      files: simulateFiles.map(f => ({ path: f.path, role: 'write' })),
      contextFiles: [],
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
      }

      outputStatus = 'success';
      tokensUsed = parsed.tokensUsed;
      cost = parsed.cost;
      filesProduced = parsed.files;
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

  // 11. Emit completion audit
  emitAudit('runner.completed', {
    taskId, featureSlug, status: outputStatus,
    tokensUsed: tokensUsed.total, cost, durationMs,
    dryRun, model: activeModel.id, tier: activeTier, attempts: attempt,
  });

  return {
    success: true,
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
  };
}
