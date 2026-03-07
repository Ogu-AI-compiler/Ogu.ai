import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ── Phase 4B: Workflow & State ──
import { createWorkflow } from '../../ogu/commands/lib/workflow-engine.mjs';
import { checkAutoTransitions, verifyInvariants, checkTimeout } from '../../ogu/commands/lib/state-machine-v2.mjs';
import { getStateDir } from '../../ogu/commands/lib/runtime-paths.mjs';

/**
 * State Machine Loop — checks feature states and fires auto-transitions.
 *
 * Reads: .ogu/state/features/*.state.json
 * Writes: auto-transitions when conditions are met
 */

const FEATURES_DIR = (root) => join(getStateDir(root), 'features');

export function createStateMachineLoop({ root, intervalMs, emitAudit }) {
  let timer = null;
  let running = true;
  let lastTick = null;
  let tickCount = 0;

  const tick = async () => {
    lastTick = new Date().toISOString();
    tickCount++;

    // Check system halt — frozen systems should not auto-transition
    const haltPath = join(getStateDir(root), 'system-halt.json');
    if (existsSync(haltPath)) {
      try {
        const halt = JSON.parse(readFileSync(haltPath, 'utf8'));
        if (halt.halted) return;
      } catch { /* ignore corrupt */ }
    }
    const freezePath = join(getStateDir(root), 'company-freeze.json');
    if (existsSync(freezePath)) {
      try {
        const freeze = JSON.parse(readFileSync(freezePath, 'utf8'));
        if (freeze.frozen) return;
      } catch { /* ignore corrupt */ }
    }

    const dir = FEATURES_DIR(root);
    if (!existsSync(dir)) return;

    const files = readdirSync(dir).filter(f => f.endsWith('.state.json'));

    for (const file of files) {
      const state = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      const slug = state.slug || file.replace('.state.json', '');

      // ── v2: verify invariants for current state ──
      try {
        const invariantResult = verifyInvariants(root, slug);
        if (!invariantResult.valid && invariantResult.violations.length > 0) {
          emitAudit('feature.invariant_violation', {
            slug,
            state: state.currentState,
            violations: invariantResult.violations,
          });
        }
      } catch { /* best-effort */ }

      // ── v2: check for timeout escalation ──
      try {
        const timeout = checkTimeout(root, slug);
        if (timeout?.timedOut) {
          emitAudit('feature.state_timeout', {
            slug,
            state: state.currentState,
            escalation: timeout.escalation,
            elapsedMs: timeout.elapsedMs,
          });
        }
      } catch { /* best-effort */ }

      // ── v2: attempt automatic transitions via state-machine-v2 ──
      try {
        const autoResult = checkAutoTransitions(root, slug);
        if (autoResult?.success) {
          emitAudit('feature.auto_transition', {
            slug,
            from: autoResult.previousState,
            to: autoResult.newState,
            transitionId: autoResult.transitionId,
            reason: 'auto condition met',
          });
          continue; // v2 handled the transition
        }
      } catch { /* best-effort */ }

      // ── Legacy fallback: if all tasks in a "building" feature are completed → auto-transition to "built" ──
      if (state.currentState === 'building' && state.tasks && state.tasks.length > 0) {
        const allDone = state.tasks.every(t => t.status === 'completed');
        if (allDone) {
          // Use workflow engine to validate the transition steps
          const transitionWorkflow = createWorkflow({ id: `transition-${slug}-building-built` });
          transitionWorkflow.addStep({ id: 'check_all_done', handler: () => ({ ok: allDone }) });
          transitionWorkflow.addStep({ id: 'write_state', handler: () => {
            const from = state.currentState;
            state.previousState = from;
            state.currentState = 'built';
            state.enteredAt = new Date().toISOString();
            state.transitionedBy = { type: 'auto', id: 'kadima-daemon' };
            state.version = (state.version || 0) + 1;
            state.updatedAt = new Date().toISOString();
            writeFileSync(join(dir, file), JSON.stringify(state, null, 2), 'utf8');
            return { ok: true };
          }});

          const wfResult = transitionWorkflow.run({});
          if (wfResult.completed) {
            emitAudit('feature.auto_transition', {
              slug: state.slug || slug,
              from: 'building',
              to: 'built',
              reason: 'All tasks completed',
            });
          }
        }
      }
    }
  };

  timer = setInterval(async () => {
    if (!running) return;
    try {
      await tick();
    } catch (err) {
      emitAudit('statemachine.loop_error', { error: err.message });
    }
  }, intervalMs);

  return {
    name: 'state-machine',
    get isRunning() { return running; },
    get lastTick() { return lastTick; },
    get tickCount() { return tickCount; },
    stop() { running = false; clearInterval(timer); },
    forceTick: tick,
  };
}
