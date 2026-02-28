/**
 * State Machine Builder — fluent API for building state machines.
 */
export function createStateMachineBuilder() {
  const states = new Set();
  const transitions = new Map();
  let initial = null;
  const builder = {
    addState(name) { states.add(name); return builder; },
    addTransition(from, event, to) {
      const key = `${from}:${event}`;
      transitions.set(key, to);
      return builder;
    },
    setInitial(state) { initial = state; return builder; },
    build() {
      let current = initial;
      return {
        current() { return current; },
        send(event) {
          const key = `${current}:${event}`;
          if (transitions.has(key)) current = transitions.get(key);
        },
        getStates() { return [...states]; }
      };
    }
  };
  return builder;
}
