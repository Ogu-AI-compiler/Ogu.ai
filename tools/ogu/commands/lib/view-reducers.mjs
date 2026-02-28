/**
 * View Reducers — reduce events into specific materialized views.
 */

/**
 * DAG view reducer — tracks task states.
 */
export function dagViewReducer(state, event) {
  if (event.type === 'TASK_STARTED') {
    return {
      ...state,
      tasks: {
        ...state.tasks,
        [event.payload.taskId]: { status: 'running', agentId: event.payload.agentId },
      },
    };
  }
  if (event.type === 'TASK_COMPLETED') {
    const task = state.tasks[event.payload.taskId] || {};
    return {
      ...state,
      tasks: {
        ...state.tasks,
        [event.payload.taskId]: { ...task, status: 'completed' },
      },
    };
  }
  if (event.type === 'TASK_FAILED') {
    const task = state.tasks[event.payload.taskId] || {};
    return {
      ...state,
      tasks: {
        ...state.tasks,
        [event.payload.taskId]: { ...task, status: 'failed', error: event.payload.error },
      },
    };
  }
  return state;
}

/**
 * Budget view reducer — tracks spending by role.
 */
export function budgetViewReducer(state, event) {
  if (event.type === 'BUDGET_TICK') {
    const amount = event.payload.amount || 0;
    const roleId = event.payload.roleId;
    const byRole = { ...state.byRole };
    byRole[roleId] = (byRole[roleId] || 0) + amount;
    return {
      ...state,
      total: state.total + amount,
      byRole,
    };
  }
  return state;
}

/**
 * Governance view reducer — tracks pending approvals and blocks.
 */
export function governanceViewReducer(state, event) {
  if (event.type === 'GOV_BLOCKED') {
    return {
      ...state,
      pendingApprovals: [...state.pendingApprovals, event.payload],
      blockedTasks: state.blockedTasks + 1,
    };
  }
  if (event.type === 'GOV_APPROVED') {
    return {
      ...state,
      pendingApprovals: state.pendingApprovals.filter(a => a.taskId !== event.payload.taskId),
      blockedTasks: Math.max(0, state.blockedTasks - 1),
    };
  }
  return state;
}

/**
 * Lock view reducer — tracks active locks.
 */
export function lockViewReducer(state, event) {
  if (event.type === 'LOCK_ACQUIRED') {
    return {
      ...state,
      locks: { ...state.locks, [event.payload.resource]: event.payload.agentId },
    };
  }
  if (event.type === 'LOCK_RELEASED') {
    const locks = { ...state.locks };
    delete locks[event.payload.resource];
    return { ...state, locks };
  }
  return state;
}

export const VIEW_DEFINITIONS = [
  { name: 'dag', initialState: { tasks: {} }, reducer: dagViewReducer },
  { name: 'budget', initialState: { total: 0, byRole: {} }, reducer: budgetViewReducer },
  { name: 'governance', initialState: { pendingApprovals: [], blockedTasks: 0 }, reducer: governanceViewReducer },
  { name: 'locks', initialState: { locks: {} }, reducer: lockViewReducer },
];
