/**
 * Hierarchical State Machine — nested states with substates.
 */

export function createHSM({ initial, states }) {
  let current = initial;

  // If the initial state has substates, enter the substate initial
  if (states[initial] && states[initial].initial) {
    current = `${initial}.${states[initial].initial}`;
  }

  function send(event) {
    // Try current substate first, then parent
    const parts = current.split(".");

    for (let depth = parts.length; depth >= 1; depth--) {
      const statePath = parts.slice(0, depth);
      const stateConfig = resolveState(statePath, states);

      if (stateConfig && stateConfig.on && stateConfig.on[event]) {
        const target = stateConfig.on[event];
        transitionTo(target, statePath);
        return;
      }
    }
  }

  function resolveState(path, stateMap) {
    let config = stateMap[path[0]];
    for (let i = 1; i < path.length; i++) {
      if (!config || !config.states) return null;
      config = config.states[path[i]];
    }
    return config;
  }

  function transitionTo(target, fromPath) {
    if (target.startsWith("#")) {
      // Absolute reference — go to root state
      const rootState = target.slice(1);
      current = rootState;
      // Enter substate if it has one
      const config = states[rootState];
      if (config && config.initial) {
        current = `${rootState}.${config.initial}`;
      }
      return;
    }

    // Relative: sibling state within same parent
    if (fromPath.length > 1) {
      const parent = fromPath.slice(0, -1).join(".");
      current = `${parent}.${target}`;
    } else {
      current = target;
    }

    // Enter substate if the target has one
    const targetParts = current.split(".");
    const targetConfig = resolveState(targetParts, states);
    if (targetConfig && targetConfig.initial) {
      current = `${current}.${targetConfig.initial}`;
    }
  }

  function getState() {
    return current;
  }

  return { send, getState };
}
