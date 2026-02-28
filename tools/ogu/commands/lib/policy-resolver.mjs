/**
 * Policy Resolver — conflict resolution engine for policy effects.
 *
 * Strategy (formal and deterministic):
 * 1. Group effects by conflict group
 * 2. Within each group, apply merge strategy
 * 3. Explicit > implicit (requireApprovals kills autoApprove)
 * 4. Restrictive > permissive (block beats allow)
 * 5. All decisions logged for audit trace
 */

// ── Legacy exports (backwards compat) ──────────────────────────────────

export const RESOLUTION_STRATEGIES = ['highest-priority', 'deny-overrides', 'first-match', 'permit-overrides'];

/**
 * Legacy: Resolve conflicts between multiple policies.
 */
export function resolveConflicts(policies, strategy = 'deny-overrides') {
  if (!policies || policies.length === 0) {
    return { id: null, effect: 'deny' };
  }

  // New-style call: array of RuleNodes with effects
  if (policies.length > 0 && policies[0].effects) {
    return resolveRuleConflicts(policies);
  }

  // Legacy call
  switch (strategy) {
    case 'highest-priority': {
      const sorted = [...policies].sort((a, b) => (b.priority || 0) - (a.priority || 0));
      return sorted[0];
    }
    case 'deny-overrides': {
      const deny = policies.find(p => p.effect === 'deny');
      return deny || policies[0];
    }
    case 'permit-overrides': {
      const permit = policies.find(p => p.effect === 'permit');
      return permit || policies[0];
    }
    case 'first-match':
    default:
      return policies[0];
  }
}

// ── New: Deterministic Conflict Resolution ──────────────────────────────

/**
 * Resolve conflicts between effects from multiple matching rules.
 *
 * @param {Array} matchedRules - Array of RuleNode objects with .effects
 * @returns {{ resolved: object, resolutionLog: Array }}
 */
export function resolveRuleConflicts(matchedRules) {
  const groups = new Map(); // group → [{ ruleId, priority, effect }]
  const resolutionLog = [];

  // Step 1: Group all effects
  for (const rule of matchedRules) {
    for (const effect of (rule.effects || [])) {
      const group = effect.group || 'unknown';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push({
        ruleId: rule.id,
        priority: rule.priority,
        effect,
      });
    }
  }

  // Step 2: Resolve each group
  const resolved = {};

  for (const [group, entries] of groups) {
    // Sort by priority DESC, then ruleId ASC (deterministic)
    entries.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.ruleId.localeCompare(b.ruleId);
    });

    const mergeStrategy = entries[0].effect.merge || 'replace';
    const result = applyMerge(mergeStrategy, entries);

    resolved[group] = result.value;
    resolutionLog.push({
      group,
      strategy: mergeStrategy,
      candidates: entries.map(e => ({ rule: e.ruleId, priority: e.priority, effect: e.effect.effect })),
      winner: result.winner,
      conflicts: result.conflicts,
    });
  }

  // Step 3: Apply hardcoded invariants
  applyInvariants(resolved);

  return { resolved, resolutionLog };
}

/**
 * Apply merge strategy to a set of effects in the same group.
 */
function applyMerge(strategy, entries) {
  switch (strategy) {
    case 'max':
      return pickMax(entries);
    case 'min':
      return pickMin(entries);
    case 'union':
      return mergeUnion(entries);
    case 'replace':
      return pickHighestPriority(entries);
    case 'append':
      return appendAll(entries);
    default:
      return pickHighestPriority(entries);
  }
}

function pickMax(entries) {
  const numericValue = (e) => {
    const p = e.effect.params || {};
    return p.count || p.tier || p.maxParallel || 0;
  };

  let max = entries[0];
  const conflicts = [];

  for (let i = 1; i < entries.length; i++) {
    if (numericValue(entries[i]) > numericValue(max)) {
      conflicts.push({ loser: max.ruleId, winner: entries[i].ruleId, reason: 'lower value' });
      max = entries[i];
    } else if (numericValue(entries[i]) === numericValue(max)) {
      conflicts.push({ tied: [max.ruleId, entries[i].ruleId], resolved: 'priority tiebreak' });
    }
  }

  return { value: max.effect, winner: max.ruleId, conflicts };
}

function pickMin(entries) {
  const numericValue = (e) => {
    const p = e.effect.params || {};
    return p.tier || p.maxParallel || Infinity;
  };

  let min = entries[0];
  const conflicts = [];

  for (let i = 1; i < entries.length; i++) {
    if (numericValue(entries[i]) < numericValue(min)) {
      conflicts.push({ loser: min.ruleId, winner: entries[i].ruleId, reason: 'higher value (less restrictive)' });
      min = entries[i];
    }
  }

  return { value: min.effect, winner: min.ruleId, conflicts };
}

function mergeUnion(entries) {
  const combined = new Set();
  for (const e of entries) {
    for (const val of Object.values(e.effect.params || {}).flat()) {
      if (val !== undefined && val !== null) combined.add(val);
    }
  }
  return { value: { ...entries[0].effect, params: { combined: [...combined] } }, winner: 'merged', conflicts: [] };
}

function pickHighestPriority(entries) {
  return {
    value: entries[0].effect,
    winner: entries[0].ruleId,
    conflicts: entries.length > 1
      ? [{ overridden: entries.slice(1).map(e => e.ruleId), by: entries[0].ruleId }]
      : [],
  };
}

function appendAll(entries) {
  return {
    value: entries.map(e => e.effect),
    winner: 'all',
    conflicts: [],
  };
}

/**
 * Hardcoded invariants that no rule can override.
 */
function applyInvariants(resolved) {
  // INVARIANT 1: explicit approval always beats autoApprove
  if (resolved.approval?.effect === 'requireApprovals') {
    delete resolved.autoApproved;
  }

  // INVARIANT 2: deny/blockExecution is absolute
  if (resolved.execution?.effect === 'deny' || resolved.execution?.effect === 'blockExecution') {
    resolved._blocked = true;
  }

  // INVARIANT 3: model tier cannot exceed org max (tier 3)
  if (resolved.model_tier?.params?.tier > 3) {
    resolved.model_tier.params.tier = 3;
  }
}

/**
 * Format resolution log as human-readable trace.
 */
export function formatResolutionTrace(resolutionLog) {
  const lines = ['POLICY CONFLICT RESOLUTION TRACE:', ''];

  for (const entry of resolutionLog) {
    lines.push(`  GROUP: ${entry.group}`);
    for (const c of entry.candidates) {
      lines.push(`    ┌ ${c.rule}  (priority: ${c.priority})  → ${c.effect}`);
    }
    lines.push(`    MERGE: ${entry.strategy} → winner: ${entry.winner}`);
    if (entry.conflicts.length > 0) {
      for (const conflict of entry.conflicts) {
        if (conflict.loser) {
          lines.push(`    ⚡ Conflict: ${conflict.loser} overridden by ${conflict.winner} (${conflict.reason})`);
        } else if (conflict.overridden) {
          lines.push(`    ⚡ Conflict: ${conflict.overridden.join(', ')} overridden by ${conflict.by}`);
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
