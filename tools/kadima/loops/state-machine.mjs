import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * State Machine Loop — checks feature states and fires auto-transitions.
 *
 * Reads: .ogu/state/features/*.state.json
 * Writes: auto-transitions when conditions are met
 */

const FEATURES_DIR = (root) => join(root, '.ogu/state/features');

export function createStateMachineLoop({ root, intervalMs, emitAudit }) {
  let timer = null;
  let running = true;
  let lastTick = null;
  let tickCount = 0;

  const tick = async () => {
    lastTick = new Date().toISOString();
    tickCount++;

    // Check system halt — frozen systems should not auto-transition
    const haltPath = join(root, '.ogu/state/system-halt.json');
    if (existsSync(haltPath)) {
      try {
        const halt = JSON.parse(readFileSync(haltPath, 'utf8'));
        if (halt.halted) return;
      } catch { /* ignore corrupt */ }
    }
    const freezePath = join(root, '.ogu/state/company-freeze.json');
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

      // Check for auto-transition conditions
      // For now: if all tasks in a "building" feature are completed → auto-transition to "built"
      if (state.currentState === 'building' && state.tasks && state.tasks.length > 0) {
        const allDone = state.tasks.every(t => t.status === 'completed');
        if (allDone) {
          const from = state.currentState;
          state.previousState = from;
          state.currentState = 'built';
          state.enteredAt = new Date().toISOString();
          state.transitionedBy = { type: 'auto', id: 'kadima-daemon' };
          state.version += 1;
          state.updatedAt = new Date().toISOString();

          writeFileSync(join(dir, file), JSON.stringify(state, null, 2), 'utf8');
          emitAudit('feature.auto_transition', {
            slug: state.slug,
            from,
            to: 'built',
            reason: 'All tasks completed',
          });
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
