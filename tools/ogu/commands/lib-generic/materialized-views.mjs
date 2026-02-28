/**
 * Materialized Views — derived state reducers from event stream.
 *
 * Reduces event envelopes into materialized views:
 * - budgetByFeature: spending per feature/model
 * - locks: active file/symbol locks
 * - governanceQueue: pending approvals
 * - activeVMs: running agent sessions
 */

/**
 * Create a materialized view store.
 *
 * @returns {{ apply, getView, getSnapshot }}
 */
export function createViewStore() {
  const views = {
    budgetByFeature: {},
    locks: {},
    governanceQueue: [],
    activeVMs: [],
  };

  const reducers = {
    'budget.spent': (payload) => {
      const { feature, amount, model } = payload;
      if (!views.budgetByFeature[feature]) {
        views.budgetByFeature[feature] = { total: 0, byModel: {} };
      }
      views.budgetByFeature[feature].total += amount;
      if (model) {
        views.budgetByFeature[feature].byModel[model] =
          (views.budgetByFeature[feature].byModel[model] || 0) + amount;
      }
    },

    'lock.acquired': (payload) => {
      views.locks[payload.filePath] = {
        taskId: payload.taskId,
        roleId: payload.roleId,
        acquiredAt: new Date().toISOString(),
      };
    },

    'lock.released': (payload) => {
      delete views.locks[payload.filePath];
    },

    'governance.pending': (payload) => {
      views.governanceQueue.push({
        id: payload.id,
        action: payload.action,
        requester: payload.requester,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    },

    'governance.resolved': (payload) => {
      views.governanceQueue = views.governanceQueue.filter(g => g.id !== payload.id);
    },

    'agent.started': (payload) => {
      views.activeVMs.push({
        sessionId: payload.sessionId,
        roleId: payload.roleId,
        taskId: payload.taskId,
        startedAt: new Date().toISOString(),
      });
    },

    'agent.stopped': (payload) => {
      views.activeVMs = views.activeVMs.filter(v => v.sessionId !== payload.sessionId);
    },
  };

  return {
    /**
     * Apply an event to update materialized views.
     */
    apply(event) {
      const reducer = reducers[event.type];
      if (reducer) {
        reducer(event.payload || {});
      }
    },

    /**
     * Get a specific materialized view.
     */
    getView(name) {
      return views[name] || null;
    },

    /**
     * Get a snapshot of all views.
     */
    getSnapshot() {
      return { ...views };
    },
  };
}
