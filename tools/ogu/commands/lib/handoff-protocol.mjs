/**
 * handoff-protocol.mjs — cross-task handoff coordination.
 *
 * Manages agent-to-agent context passing within a DAG wave execution.
 * Stores pending handoffs in memory; downstream tasks can pick up
 * context left by upstream completions.
 */

/**
 * Create a new handoff protocol instance.
 * @returns {{ initiateHandoff, receiveHandoff, clearHandoffs }}
 */
export function createHandoffProtocol() {
  const pending = new Map(); // key: toAgent+taskId → context

  /**
   * Initiate a handoff from one agent to another.
   * @param {{ fromAgent, toAgent, taskId, context }} options
   */
  function initiateHandoff({ fromAgent, toAgent, taskId, context = {} }) {
    const key = `${toAgent}::${taskId}`;
    pending.set(key, { fromAgent, toAgent, taskId, context, initiatedAt: Date.now() });
  }

  /**
   * Receive a handoff for a given agent and task.
   * Returns null if no handoff is pending.
   * @param {{ agent, taskId }} options
   * @returns {object|null}
   */
  function receiveHandoff({ agent, taskId }) {
    const key = `${agent}::${taskId}`;
    const handoff = pending.get(key) || null;
    if (handoff) pending.delete(key);
    return handoff;
  }

  /**
   * Clear all pending handoffs (e.g. on DAG reset).
   */
  function clearHandoffs() {
    pending.clear();
  }

  return { initiateHandoff, receiveHandoff, clearHandoffs };
}
