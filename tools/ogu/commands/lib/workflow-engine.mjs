/**
 * workflow-engine.mjs — Sequential step workflow runner.
 */
export function createWorkflow({ id } = {}) {
  const steps = [];
  let status = 'pending';
  const results = {};

  return {
    addStep({ id: stepId, handler }) {
      steps.push({ id: stepId, handler });
    },

    async run(ctx = {}) {
      status = 'running';
      for (const step of steps) {
        try {
          const result = await step.handler(ctx);
          results[step.id] = { ok: true, result };
          if (result?.ok === false) { status = 'failed'; break; }
        } catch (err) {
          results[step.id] = { ok: false, error: err.message };
          status = 'failed';
          break;
        }
      }
      if (status === 'running') status = 'completed';
      return { id, status, results };
    },

    getStatus() { return status; },
    getResults() { return results; },
  };
}
