/**
 * System Runtime — wire all subsystems into a unified runtime.
 */

import { createKadimaEngine } from './kadima-engine.mjs';
import { createBudgetRoleTracker } from './budget-role-tracker.mjs';
import { createMaterializedViewEngine } from './materialized-view-engine.mjs';
import { VIEW_DEFINITIONS } from './view-reducers.mjs';
import { createHealthAggregator } from './health-check-aggregator.mjs';
import { createLockCoordinator } from './lock-coordinator.mjs';

/**
 * Create a system runtime that wires all subsystems together.
 *
 * @returns {object} Runtime with boot/shutdown/getSubsystem/getStatus
 */
export function createSystemRuntime() {
  let state = 'idle';
  const subsystems = new Map();

  // Simple event bus for internal communication
  function createEventBus() {
    const listeners = [];
    function on(fn) { listeners.push(fn); }
    function emit(event) {
      for (const fn of listeners) fn(event);
    }
    return { on, emit };
  }

  async function boot() {
    state = 'booting';

    // Create subsystems
    const kadimaEngine = createKadimaEngine();
    const budgetTracker = createBudgetRoleTracker({ thresholds: [0.50, 0.75, 0.90] });
    const viewEngine = createMaterializedViewEngine();
    const healthAggregator = createHealthAggregator();
    const lockCoordinator = createLockCoordinator();
    const eventBus = createEventBus();

    // Register standard views
    for (const def of VIEW_DEFINITIONS) {
      viewEngine.registerView(def.name, {
        initialState: structuredClone(def.initialState),
        reducer: def.reducer,
      });
    }

    // Wire event bus to materialized views
    eventBus.on((event) => {
      viewEngine.processEvent(event);
    });

    // Register health checks
    healthAggregator.addCheck('kadimaEngine', () => ({ status: 'healthy' }));
    healthAggregator.addCheck('budgetTracker', () => ({ status: 'healthy' }));
    healthAggregator.addCheck('viewEngine', () => ({ status: 'healthy' }));

    // Store subsystems
    subsystems.set('kadimaEngine', kadimaEngine);
    subsystems.set('budgetTracker', budgetTracker);
    subsystems.set('viewEngine', viewEngine);
    subsystems.set('healthAggregator', healthAggregator);
    subsystems.set('lockCoordinator', lockCoordinator);
    subsystems.set('eventBus', eventBus);

    state = 'running';
  }

  function getSubsystem(name) {
    return subsystems.get(name) || null;
  }

  async function shutdown() {
    state = 'stopped';
  }

  function getStatus() {
    return {
      state,
      subsystems: Array.from(subsystems.keys()),
    };
  }

  return { boot, shutdown, getSubsystem, getStatus };
}
