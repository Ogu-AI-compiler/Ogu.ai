/**
 * Phase Coordinator — coordinate transitions between pipeline phases.
 */

/**
 * Create a phase coordinator.
 *
 * @returns {object} Coordinator with registerTransition/canTransition/transition/listTransitions
 */
export function createPhaseCoordinator() {
  const transitions = []; // { from, to, gate, check }

  function registerTransition(from, to, { gate, check } = {}) {
    transitions.push({ from, to, gate: gate || `${from}-to-${to}`, check: check || (() => true) });
  }

  function listTransitions() {
    return transitions.map(t => ({ from: t.from, to: t.to, gate: t.gate }));
  }

  function canTransition(from, to) {
    return transitions.some(t => t.from === from && t.to === to);
  }

  function transition(from, to) {
    const t = transitions.find(t => t.from === from && t.to === to);
    if (!t) {
      return { allowed: false, blockedBy: 'no-transition-defined', from, to };
    }

    const passed = t.check();
    if (!passed) {
      return { allowed: false, blockedBy: t.gate, from, to };
    }

    return { allowed: true, from, to, gate: t.gate, timestamp: new Date().toISOString() };
  }

  return { registerTransition, canTransition, transition, listTransitions };
}
