/**
 * Audit Replay — reconstruct state from an event sequence.
 *
 * Replays events in order and accumulates state counters.
 */

/**
 * Replay a chain of events and compute derived state.
 *
 * @param {Array<{ type: string, payload?: object }>} events
 * @returns {{ tasksCompleted: number, tasksFailed: number, gatesPassed: number, transitions: number, features: Set }}
 */
export function replayChain(events) {
  const state = {
    tasksCompleted: 0,
    tasksFailed: 0,
    gatesPassed: 0,
    transitions: 0,
    features: new Set(),
  };

  for (const event of events) {
    const feature = event.payload?.feature;
    if (feature) state.features.add(feature);

    switch (event.type) {
      case 'task.completed':
        state.tasksCompleted++;
        break;
      case 'task.failed':
        state.tasksFailed++;
        break;
      case 'gate.passed':
        state.gatesPassed++;
        break;
      case 'feature.transitioned':
        state.transitions++;
        break;
    }
  }

  return {
    ...state,
    features: [...state.features],
  };
}
