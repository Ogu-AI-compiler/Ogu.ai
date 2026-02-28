/**
 * Runner — abstract runner interface (execute → OutputEnvelope).
 */

export const RUNNER_TYPES = ['local', 'remote', 'microvm', 'container'];

/**
 * Create an input envelope for a runner task.
 *
 * @param {{ taskId: string, command: string, payload?: object }} opts
 * @returns {object}
 */
export function createInputEnvelope({ taskId, command, payload = {} }) {
  return {
    taskId,
    command,
    payload,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an output envelope from a runner result.
 *
 * @param {{ taskId: string, status: string, result?: object, error?: string }} opts
 * @returns {object}
 */
export function createOutputEnvelope({ taskId, status, result = {}, error = null }) {
  return {
    taskId,
    status,
    result,
    error,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate that an object satisfies the Runner contract.
 *
 * @param {object} runner
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRunner(runner) {
  const errors = [];
  if (typeof runner.name !== 'string') errors.push('missing name');
  if (typeof runner.type !== 'string') errors.push('missing type');
  if (typeof runner.execute !== 'function') errors.push('missing execute function');
  return { valid: errors.length === 0, errors };
}
