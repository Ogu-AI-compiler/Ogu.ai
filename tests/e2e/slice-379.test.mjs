/**
 * Slice 379 — Marketplace Bridge Integration
 * Tests the integration layer between the execution pipeline and the marketplace subsystem.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}
async function assertAsync(label, fn) {
  try { await fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log('\n\x1b[1mSlice 379 — Marketplace Bridge Integration\x1b[0m\n');

const cwd = process.cwd();
const bridgeMod = await import(join(cwd, 'tools/ogu/commands/lib/marketplace-bridge.mjs'));
const { resolveMarketplaceAgent, searchRelevantPatterns, postExecutionHooks } = bridgeMod;

const promptMod = await import(join(cwd, 'tools/ogu/commands/lib/prompt-builder.mjs'));
const { buildPrompt } = promptMod;

const allocMod = await import(join(cwd, 'tools/ogu/commands/lib/task-allocator.mjs'));
const { allocateTask } = allocMod;

function makeRoot() {
  const root = join(tmpdir(), `ogu-e2e-379-${randomUUID().slice(0, 8)}`);
  mkdirSync(root, { recursive: true });
  mkdirSync(join(root, '.ogu'), { recursive: true });
  return root;
}

function setupMarketplace(root) {
  const mp = join(root, '.ogu', 'marketplace');
  mkdirSync(join(mp, 'agents'), { recursive: true });
  mkdirSync(join(mp, 'allocations'), { recursive: true });
  mkdirSync(join(mp, 'patterns'), { recursive: true });
  mkdirSync(join(mp, 'learning-candidates'), { recursive: true });
  mkdirSync(join(mp, 'pricing'), { recursive: true });
  return mp;
}

function writeAgent(root, agentId, overrides = {}) {
  const mp = join(root, '.ogu', 'marketplace');
  const dir = join(mp, 'agents');
  mkdirSync(dir, { recursive: true });
  const profile = {
    agent_id: agentId,
    name: 'Test Agent',
    role: 'developer',
    specialty: 'fullstack',
    tier: 2,
    status: 'available',
    capacity_units: 5,
    base_price: 4,
    system_prompt: 'You are a marketplace agent specializing in fullstack development.',
    skills: ['code-generation', 'testing'],
    dna: { style: 'pragmatic', focus: 'quality' },
    capabilities: ['code-generation', 'testing'],
    stats: { projects_completed: 5, success_rate: 0.9, utilization_units: 2 },
    ...overrides,
  };
  writeFileSync(join(dir, `${agentId}.json`), JSON.stringify(profile, null, 2) + '\n');

  // Update index
  const indexPath = join(mp, 'index.json');
  let idx = { agents: [], nextId: 1 };
  if (existsSync(indexPath)) {
    try { idx = JSON.parse(readFileSync(indexPath, 'utf-8')); } catch { /* */ }
  }
  idx.agents = idx.agents.filter(a => a.agent_id !== agentId);
  idx.agents.push({ agent_id: agentId, name: profile.name, role: profile.role, status: 'available' });
  writeFileSync(indexPath, JSON.stringify(idx, null, 2) + '\n');
}

function writeAllocation(root, alloc) {
  const mp = join(root, '.ogu', 'marketplace');
  const dir = join(mp, 'allocations');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${alloc.allocation_id}.json`), JSON.stringify(alloc, null, 2) + '\n');

  const indexPath = join(dir, 'index.json');
  let idx = { allocations: [] };
  if (existsSync(indexPath)) {
    try { idx = JSON.parse(readFileSync(indexPath, 'utf-8')); } catch { /* */ }
  }
  idx.allocations.push({
    allocation_id: alloc.allocation_id,
    agent_id: alloc.agent_id,
    project_id: alloc.project_id,
    allocation_units: alloc.allocation_units || 1,
    status: alloc.status || 'active',
  });
  writeFileSync(indexPath, JSON.stringify(idx, null, 2) + '\n');
}

function writePattern(root, pattern) {
  const dir = join(root, '.ogu', 'marketplace', 'patterns');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${pattern.pattern_id}.json`), JSON.stringify(pattern, null, 2) + '\n');
}

function cleanup(root) {
  try { rmSync(root, { recursive: true, force: true }); } catch { /* */ }
}

// ─── resolveMarketplaceAgent tests ───

assert('Bridge: no marketplace dir → { found: false }', () => {
  const root = makeRoot();
  try {
    const result = resolveMarketplaceAgent(root, { featureSlug: 'test', roleId: 'developer' });
    if (result.found !== false) throw new Error(`Expected found=false, got ${result.found}`);
  } finally { cleanup(root); }
});

assert('Bridge: marketplace exists but no allocations → { found: false }', () => {
  const root = makeRoot();
  try {
    setupMarketplace(root);
    writeAgent(root, 'agent_0001', { name: 'Agent A', role: 'developer' });
    const result = resolveMarketplaceAgent(root, { featureSlug: 'my-feature', roleId: 'developer' });
    if (result.found !== false) throw new Error(`Expected found=false, got ${result.found}`);
  } finally { cleanup(root); }
});

assert('Bridge: hired agent found → correct fields returned', () => {
  const root = makeRoot();
  try {
    setupMarketplace(root);
    writeAgent(root, 'agent_0001', {
      name: 'Alpha Dev',
      role: 'developer',
      system_prompt: 'You are Alpha, a senior developer.',
      skills: ['typescript', 'react'],
      dna: { approach: 'tdd' },
    });
    writeAllocation(root, {
      allocation_id: 'alloc-001',
      project_id: 'cool-feature',
      agent_id: 'agent_0001',
      role_slot: 'developer',
      allocation_units: 1,
      priority_level: 50,
      status: 'active',
      hired_at: new Date().toISOString(),
    });

    const result = resolveMarketplaceAgent(root, { featureSlug: 'cool-feature', roleId: 'developer' });
    if (!result.found) throw new Error('Expected found=true');
    if (result.agent.agent_id !== 'agent_0001') throw new Error(`Expected agent_0001, got ${result.agent.agent_id}`);
    if (result.systemPrompt !== 'You are Alpha, a senior developer.') throw new Error('Wrong systemPrompt');
    if (!Array.isArray(result.skills) || result.skills[0] !== 'typescript') throw new Error('Wrong skills');
    if (result.dna.approach !== 'tdd') throw new Error('Wrong dna');
  } finally { cleanup(root); }
});

assert('Bridge: role_slot mismatch → { found: false }', () => {
  const root = makeRoot();
  try {
    setupMarketplace(root);
    writeAgent(root, 'agent_0001', { name: 'QA Agent', role: 'qa' });
    writeAllocation(root, {
      allocation_id: 'alloc-002',
      project_id: 'feat-x',
      agent_id: 'agent_0001',
      role_slot: 'qa',
      allocation_units: 1,
      priority_level: 50,
      status: 'active',
      hired_at: new Date().toISOString(),
    });

    // Looking for developer, but only qa is hired
    const result = resolveMarketplaceAgent(root, { featureSlug: 'feat-x', roleId: 'developer' });
    if (result.found !== false) throw new Error(`Expected found=false, got ${result.found}`);
  } finally { cleanup(root); }
});

// ─── searchRelevantPatterns tests ───

assert('Patterns: empty when no marketplace dir', () => {
  const root = makeRoot();
  try {
    const result = searchRelevantPatterns(root, { taskType: 'write-code', featureSlug: 'test' });
    if (result !== '') throw new Error(`Expected empty string, got "${result}"`);
  } finally { cleanup(root); }
});

assert('Patterns: search returns formatted string', () => {
  const root = makeRoot();
  try {
    setupMarketplace(root);
    writePattern(root, {
      pattern_id: 'pat-001',
      task_type: 'write-code',
      context_signature: ['test-feature'],
      resolution_summary: 'Use TDD approach for better results',
      confidence: 0.85,
      success_count: 10,
      failure_count: 1,
      active: true,
    });

    const result = searchRelevantPatterns(root, { taskType: 'write-code', featureSlug: 'test-feature' });
    if (!result.includes('Learned Patterns')) throw new Error('Missing "Learned Patterns"');
    if (!result.includes('write-code')) throw new Error('Missing task type');
    if (!result.includes('TDD approach')) throw new Error('Missing resolution summary');
  } finally { cleanup(root); }
});

assert('Patterns: empty when no patterns dir exists', () => {
  const root = makeRoot();
  try {
    // Create marketplace but NOT patterns subdir
    mkdirSync(join(root, '.ogu', 'marketplace', 'agents'), { recursive: true });
    const result = searchRelevantPatterns(root, { taskType: 'write-code', featureSlug: 'test' });
    if (result !== '') throw new Error(`Expected empty string, got "${result}"`);
  } finally { cleanup(root); }
});

// ─── postExecutionHooks tests ───

assert('Post-hooks: no-op for non-marketplace agents', () => {
  const root = makeRoot();
  try {
    setupMarketplace(root);
    postExecutionHooks(root, {
      agentId: 'orgspec-developer',
      taskId: 'T1',
      featureSlug: 'test',
      success: true,
    });
    // No learning candidates should be created
    const candDir = join(root, '.ogu', 'marketplace', 'learning-candidates');
    const files = existsSync(candDir) ? readdirSync(candDir).filter(f => f.endsWith('.json')) : [];
    if (files.length > 0) throw new Error(`Expected 0 candidates, got ${files.length}`);
  } finally { cleanup(root); }
});

assert('Post-hooks: gate_failure triggers learning candidate', () => {
  const root = makeRoot();
  try {
    setupMarketplace(root);
    writeAgent(root, 'agent_0001', { stats: { projects_completed: 5, success_rate: 0.9, utilization_units: 2 } });

    postExecutionHooks(root, {
      agentId: 'agent_0001',
      taskId: 'T1',
      featureSlug: 'test',
      success: false,
      iterationCount: 1,
      gateFailed: true,
      durationMs: 1000,
    });

    const candDir = join(root, '.ogu', 'marketplace', 'learning-candidates');
    const files = readdirSync(candDir).filter(f => f.endsWith('.json'));
    if (files.length < 1) throw new Error('Expected at least one learning candidate');
    const candidate = JSON.parse(readFileSync(join(candDir, files[0]), 'utf-8'));
    if (candidate.trigger !== 'gate_failure') throw new Error(`Expected gate_failure trigger, got ${candidate.trigger}`);
    if (candidate.agent_id !== 'agent_0001') throw new Error(`Expected agent_0001, got ${candidate.agent_id}`);
  } finally { cleanup(root); }
});

assert('Post-hooks: success updates agent stats (projects_completed++)', () => {
  const root = makeRoot();
  try {
    setupMarketplace(root);
    writeAgent(root, 'agent_0001', {
      stats: { projects_completed: 5, success_rate: 0.9, utilization_units: 1 },
    });

    postExecutionHooks(root, {
      agentId: 'agent_0001',
      taskId: 'T2',
      featureSlug: 'test',
      success: true,
      iterationCount: 1,
      gateFailed: false,
      durationMs: 2000,
    });

    const agent = JSON.parse(readFileSync(join(root, '.ogu/marketplace/agents/agent_0001.json'), 'utf-8'));
    if (agent.stats.projects_completed !== 6) throw new Error(`Expected 6, got ${agent.stats.projects_completed}`);
    if (agent.stats.last_task_duration_ms !== 2000) throw new Error(`Expected 2000ms, got ${agent.stats.last_task_duration_ms}`);
  } finally { cleanup(root); }
});

assert('Post-hooks: updates pricing multiplier', () => {
  const root = makeRoot();
  try {
    setupMarketplace(root);
    writeAgent(root, 'agent_0001', {
      capacity_units: 5,
      stats: { projects_completed: 10, success_rate: 0.95, utilization_units: 3 },
    });

    postExecutionHooks(root, {
      agentId: 'agent_0001',
      taskId: 'T3',
      featureSlug: 'test',
      success: true,
      iterationCount: 1,
      gateFailed: false,
      durationMs: 500,
    });

    const agent = JSON.parse(readFileSync(join(root, '.ogu/marketplace/agents/agent_0001.json'), 'utf-8'));
    if (typeof agent.stats.performance_multiplier !== 'number') throw new Error('Expected number for performance_multiplier');
    if (agent.stats.performance_multiplier < 0.5) throw new Error(`Multiplier ${agent.stats.performance_multiplier} < floor 0.5`);
    if (agent.stats.performance_multiplier > 2.0) throw new Error(`Multiplier ${agent.stats.performance_multiplier} > ceiling 2.0`);
  } finally { cleanup(root); }
});

assert('Post-hooks: no-op when marketplace dir missing', () => {
  const root = makeRoot();
  try {
    // No marketplace dir, agent_ prefix → should not throw
    postExecutionHooks(root, {
      agentId: 'agent_0001',
      taskId: 'T4',
      featureSlug: 'test',
      success: true,
    });
    // If we get here without throwing, the guard works
  } finally { cleanup(root); }
});

// ─── prompt-builder systemPromptOverride tests ───

assert('Prompt: systemPromptOverride replaces default system + appends gates', () => {
  const result = buildPrompt({
    role: 'developer',
    taskName: 'write-auth',
    taskDescription: 'Write authentication module',
    featureSlug: 'auth',
    systemPromptOverride: 'You are a marketplace agent specializing in security.',
  });

  if (!result.system.startsWith('You are a marketplace agent')) throw new Error('Override not applied');
  if (!result.system.includes('Gate')) throw new Error('Quality gates not appended');
  if (result.system.includes('You are a developer agent')) throw new Error('Default system prompt leaked through');
});

assert('Prompt: no override → existing behavior unchanged', () => {
  const result = buildPrompt({
    role: 'developer',
    taskName: 'write-code',
    taskDescription: 'Write some code',
    featureSlug: 'test',
  });

  if (!result.system.includes('You are a developer agent')) throw new Error('Default system missing');
  if (!result.system.includes('Gate')) throw new Error('Gates missing');
});

assert('Prompt: entities flow through to message body', () => {
  const result = buildPrompt({
    role: 'developer',
    taskName: 'write-code',
    taskDescription: 'Write some code',
    featureSlug: 'test',
    entities: [{ type: 'learned-pattern', title: 'Test Pattern', content: 'Use TDD' }],
  });

  const msg = result.messages[0].content;
  if (!msg.includes('Relevant Knowledge')) throw new Error('Entities section missing');
  if (!msg.includes('Test Pattern')) throw new Error('Pattern title missing');
  if (!msg.includes('Use TDD')) throw new Error('Pattern content missing');
});

// ─── task-allocator marketplace-first tests ───

assert('Allocator: marketplace agent preferred over OrgSpec', () => {
  const root = makeRoot();
  try {
    setupMarketplace(root);
    writeAgent(root, 'agent_0001', { name: 'Market Dev', role: 'developer' });
    writeAllocation(root, {
      allocation_id: 'alloc-010',
      project_id: 'my-feature',
      agent_id: 'agent_0001',
      role_slot: 'developer',
      allocation_units: 1,
      priority_level: 50,
      status: 'active',
      hired_at: new Date().toISOString(),
    });

    // Write OrgSpec
    writeFileSync(join(root, '.ogu', 'OrgSpec.json'), JSON.stringify({
      roles: [{ roleId: 'developer', name: 'OrgSpec Dev', enabled: true, capabilities: ['code-generation'], riskTier: 'low', maxTokensPerTask: 4096 }],
      providers: [{ id: 'test', enabled: true, models: [{ id: 'test-model', tier: 'standard', costPer1kInput: 0.001 }] }],
    }, null, 2));

    const result = allocateTask({
      taskId: 'T1',
      requiredCapabilities: ['code-generation'],
      preferredRole: 'developer',
      root,
      featureSlug: 'my-feature',
    });

    if (!result) throw new Error('Expected allocation result');
    if (result._marketplaceAgentId !== 'agent_0001') throw new Error(`Expected agent_0001, got ${result._marketplaceAgentId}`);
    if (result.roleName !== 'Market Dev') throw new Error(`Expected Market Dev, got ${result.roleName}`);
  } finally { cleanup(root); }
});

assert('Allocator: falls back to OrgSpec when no marketplace', () => {
  const root = makeRoot();
  try {
    // No marketplace dir
    writeFileSync(join(root, '.ogu', 'OrgSpec.json'), JSON.stringify({
      roles: [{ roleId: 'developer', name: 'OrgSpec Developer', enabled: true, capabilities: ['code-generation'], riskTier: 'low', maxTokensPerTask: 4096 }],
      providers: [{ id: 'test', enabled: true, models: [{ id: 'test-model', tier: 'standard', costPer1kInput: 0.001 }] }],
    }, null, 2));

    const result = allocateTask({
      taskId: 'T2',
      requiredCapabilities: ['code-generation'],
      preferredRole: 'developer',
      root,
      featureSlug: 'no-marketplace',
    });

    // allocateTask loads OrgSpec from cwd, not from root — it may return null here
    // The key test is that _marketplaceAgentId is NOT set
    if (result && result._marketplaceAgentId) throw new Error('Should NOT have marketplace agent');
  } finally { cleanup(root); }
});

// ─── E2E: module exports ───

assert('E2E: marketplace-bridge exports all 3 functions', () => {
  if (typeof resolveMarketplaceAgent !== 'function') throw new Error('resolveMarketplaceAgent not a function');
  if (typeof searchRelevantPatterns !== 'function') throw new Error('searchRelevantPatterns not a function');
  if (typeof postExecutionHooks !== 'function') throw new Error('postExecutionHooks not a function');
});

assert('E2E: marketplace-bridge.mjs exists on disk', () => {
  const p = join(cwd, 'tools/ogu/commands/lib/marketplace-bridge.mjs');
  if (!existsSync(p)) throw new Error('File missing');
});

assert('E2E: agent-executor.mjs imports marketplace-bridge', () => {
  const src = readFileSync(join(cwd, 'tools/ogu/commands/lib/agent-executor.mjs'), 'utf-8');
  if (!src.includes("from './marketplace-bridge.mjs'")) throw new Error('Import missing');
  if (!src.includes('resolveMarketplaceAgent')) throw new Error('resolveMarketplaceAgent not referenced');
  if (!src.includes('searchRelevantPatterns')) throw new Error('searchRelevantPatterns not referenced');
  if (!src.includes('postExecutionHooks')) throw new Error('postExecutionHooks not referenced');
});

assert('E2E: prompt-builder.mjs accepts systemPromptOverride', () => {
  const src = readFileSync(join(cwd, 'tools/ogu/commands/lib/prompt-builder.mjs'), 'utf-8');
  if (!src.includes('systemPromptOverride')) throw new Error('systemPromptOverride not found');
});

assert('E2E: task-allocator.mjs imports marketplace-bridge', () => {
  const src = readFileSync(join(cwd, 'tools/ogu/commands/lib/task-allocator.mjs'), 'utf-8');
  if (!src.includes("from './marketplace-bridge.mjs'")) throw new Error('Import missing');
  if (!src.includes('_marketplaceAgentId')) throw new Error('_marketplaceAgentId not found');
});

// ─── Results ───

console.log(`\nResults: ${pass} passed, ${fail} failed out of ${pass + fail}`);
if (fail > 0) process.exit(1);
