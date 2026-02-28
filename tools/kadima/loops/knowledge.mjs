/**
 * Knowledge Loop — The 6th Kadima daemon loop.
 *
 * Runs every 5 minutes to:
 * 1. Scan completed tasks for extractable patterns
 * 2. Store patterns in semantic memory fabric
 * 3. Curate memory: deduplicate and prune stale entries
 * 4. Emit audit events for knowledge operations
 *
 * Uses: semantic-memory.mjs (storeMemory, searchMemory, listMemories, deleteMemory)
 * Reads: .ogu/runners/*.output.json, .ogu/state/features/*.state.json
 * Writes: .ogu/memory/fabric.json (via semantic-memory)
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const KNOWLEDGE_STATE = (root) => join(root, '.ogu/state/knowledge-state.json');

function loadKnowledgeState(root) {
  const path = KNOWLEDGE_STATE(root);
  if (!existsSync(path)) {
    return { indexedTasks: [], lastCuration: null, totalIndexed: 0, totalPruned: 0 };
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { indexedTasks: [], lastCuration: null, totalIndexed: 0, totalPruned: 0 };
  }
}

function saveKnowledgeState(root, state) {
  const dir = join(root, '.ogu/state');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(KNOWLEDGE_STATE(root), JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Extract learnable patterns from a completed task output.
 */
function extractPatterns(taskId, output) {
  const patterns = [];

  // Pattern: error recovery (requires retries)
  if (output.retries && output.retries > 0) {
    patterns.push({
      content: `Task ${taskId} required ${output.retries} retries. Error: ${output.error || 'unknown'}. Recovery: succeeded after retry.`,
      tags: ['error-recovery', 'retry', output.roleId || 'unknown-role'].filter(Boolean),
      category: 'error',
    });
  }

  // Pattern: cost observation
  if (output.cost && output.cost.totalCost > 0) {
    patterns.push({
      content: `Task ${taskId} (${output.roleId || 'unknown'}) cost $${output.cost.totalCost.toFixed(4)} using ${output.cost.model || 'unknown'} (${output.cost.totalTokens || 0} tokens).`,
      tags: ['cost', output.roleId || 'unknown-role', output.cost.model || 'unknown-model'].filter(Boolean),
      category: 'insight',
    });
  }

  // Pattern: files produced
  if (output.files && output.files.length > 0) {
    const fileTypes = [...new Set(output.files.map(f => {
      const ext = (f.path || f).split('.').pop();
      return ext || 'unknown';
    }))];
    patterns.push({
      content: `Task ${taskId} produced ${output.files.length} files (types: ${fileTypes.join(', ')}). Role: ${output.roleId || 'unknown'}.`,
      tags: ['output-files', ...fileTypes, output.roleId || 'unknown-role'].filter(Boolean),
      category: 'pattern',
    });
  }

  // Pattern: task duration
  if (output.startedAt && output.completedAt) {
    const durationMs = new Date(output.completedAt) - new Date(output.startedAt);
    const durationSec = Math.round(durationMs / 1000);
    if (durationSec > 0) {
      patterns.push({
        content: `Task ${taskId} (${output.roleId || 'unknown'}) completed in ${durationSec}s.`,
        tags: ['duration', output.roleId || 'unknown-role'].filter(Boolean),
        category: 'insight',
      });
    }
  }

  return patterns;
}

/**
 * Scan for completed tasks that haven't been indexed yet.
 */
function findUnindexedTasks(root, knowledgeState) {
  const runnersDir = join(root, '.ogu/runners');
  if (!existsSync(runnersDir)) return [];

  const indexed = new Set(knowledgeState.indexedTasks || []);
  const unindexed = [];

  const files = readdirSync(runnersDir).filter(f => f.endsWith('.output.json'));
  for (const f of files) {
    const taskId = f.replace('.output.json', '');
    if (indexed.has(taskId)) continue;

    try {
      const output = JSON.parse(readFileSync(join(runnersDir, f), 'utf8'));
      unindexed.push({ taskId, output });
    } catch { /* skip corrupt */ }
  }

  return unindexed;
}

/**
 * Curate memory: remove near-duplicates and prune old low-value entries.
 *
 * @returns {{ removed: number, reason: string[] }}
 */
function curateMemory(root, memoryFns) {
  const entries = memoryFns.listMemories({ root });
  if (entries.length < 10) return { removed: 0, reasons: [] };

  const toRemove = [];
  const reasons = [];

  // Deduplication: find entries with very similar content
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (toRemove.includes(entries[j].id)) continue;
      const similarity = computeSimilarity(entries[i].content, entries[j].content);
      if (similarity > 0.85) {
        // Keep the newer one (later in list = newer)
        toRemove.push(entries[i].id);
        reasons.push(`duplicate: ${entries[i].id.slice(0, 8)}... ~= ${entries[j].id.slice(0, 8)}...`);
        break;
      }
    }
  }

  // Age-based pruning: remove insight entries older than 30 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString();

  for (const entry of entries) {
    if (toRemove.includes(entry.id)) continue;
    if (entry.category === 'insight' && entry.createdAt < cutoffStr) {
      toRemove.push(entry.id);
      reasons.push(`stale: ${entry.id.slice(0, 8)}... (${entry.category}, created ${entry.createdAt.slice(0, 10)})`);
    }
  }

  // Actually remove
  for (const id of toRemove) {
    memoryFns.deleteMemory({ root, id });
  }

  return { removed: toRemove.length, reasons };
}

/**
 * Simple word-overlap similarity (Jaccard-ish).
 */
function computeSimilarity(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Create the Knowledge Loop — 6th Kadima daemon loop.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {number} opts.intervalMs
 * @param {Function} opts.emitAudit
 */
export function createKnowledgeLoop({ root, intervalMs, emitAudit }) {
  let timer = null;
  let running = true;
  let lastTick = null;
  let tickCount = 0;
  let lastReport = null;

  // Lazy-load semantic memory (may not be available)
  let memoryFns = null;
  async function ensureMemoryFns() {
    if (memoryFns) return memoryFns;
    try {
      const mod = await import('../../ogu/commands/lib/semantic-memory.mjs');
      memoryFns = {
        storeMemory: mod.storeMemory,
        searchMemory: mod.searchMemory,
        listMemories: mod.listMemories,
        deleteMemory: mod.deleteMemory,
      };
      return memoryFns;
    } catch {
      return null;
    }
  }

  const tick = async () => {
    lastTick = new Date().toISOString();
    tickCount++;

    const fns = await ensureMemoryFns();
    if (!fns) {
      lastReport = { skipped: true, reason: 'semantic-memory not available', timestamp: lastTick };
      return;
    }

    const state = loadKnowledgeState(root);
    let indexed = 0;
    let pruned = 0;

    // Phase 1: Index unprocessed task outputs
    const unindexed = findUnindexedTasks(root, state);

    for (const { taskId, output } of unindexed) {
      const patterns = extractPatterns(taskId, output);

      for (const pattern of patterns) {
        // Check for existing similar entry to avoid flooding
        const existing = fns.searchMemory({
          root,
          query: pattern.content.slice(0, 50),
          tags: pattern.tags,
          limit: 1,
        });

        if (existing.length > 0 && existing[0].score > 4) {
          continue; // Skip — too similar to existing
        }

        fns.storeMemory({
          root,
          content: pattern.content,
          tags: pattern.tags,
          source: `task:${taskId}`,
          category: pattern.category,
        });
        indexed++;
      }

      state.indexedTasks.push(taskId);
    }

    // Phase 2: Curate memory (every 6th tick, ~30 min)
    if (tickCount % 6 === 0) {
      const curation = curateMemory(root, fns);
      pruned = curation.removed;
      state.lastCuration = lastTick;
      state.totalPruned = (state.totalPruned || 0) + pruned;
    }

    // Keep indexedTasks list bounded (last 500)
    if (state.indexedTasks.length > 500) {
      state.indexedTasks = state.indexedTasks.slice(-500);
    }

    state.totalIndexed = (state.totalIndexed || 0) + indexed;
    saveKnowledgeState(root, state);

    lastReport = {
      indexed,
      pruned,
      unindexedFound: unindexed.length,
      totalIndexed: state.totalIndexed,
      totalPruned: state.totalPruned,
      timestamp: lastTick,
    };

    if (indexed > 0 || pruned > 0) {
      emitAudit('knowledge.indexed', {
        indexed,
        pruned,
        totalIndexed: state.totalIndexed,
      });
    }
  };

  // Start the loop
  timer = setInterval(async () => {
    if (!running) return;
    try {
      await tick();
    } catch (err) {
      emitAudit('knowledge.loop_error', { error: err.message });
    }
  }, intervalMs);

  return {
    name: 'knowledge',
    get isRunning() { return running; },
    get lastTick() { return lastTick; },
    get tickCount() { return tickCount; },
    get lastReport() { return lastReport; },
    stop() { running = false; clearInterval(timer); },
    forceTick: tick,
  };
}
