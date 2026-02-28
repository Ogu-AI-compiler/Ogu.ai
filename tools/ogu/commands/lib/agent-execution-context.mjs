/**
 * Agent Execution Context — scoped context for agent task execution.
 */

/**
 * Create an agent execution context.
 *
 * @param {{ agentId: string, taskId: string, feature: string, phase: string }} meta
 * @returns {object} Context with get/set/getMetadata/addArtifact/getArtifacts/recordMetric/getMetrics
 */
export function createAgentExecutionContext({ agentId, taskId, feature, phase }) {
  const store = new Map();
  const artifacts = [];
  const metrics = {};

  function get(key) {
    return store.get(key) || null;
  }

  function set(key, value) {
    store.set(key, value);
  }

  function getMetadata() {
    return { agentId, taskId, feature, phase, createdAt: new Date().toISOString() };
  }

  function addArtifact(path) {
    artifacts.push(path);
  }

  function getArtifacts() {
    return [...artifacts];
  }

  function recordMetric(name, value) {
    metrics[name] = value;
  }

  function getMetrics() {
    return { ...metrics };
  }

  return { get, set, getMetadata, addArtifact, getArtifacts, recordMetric, getMetrics };
}
