/**
 * Workflow Engine — multi-step workflow execution with branching.
 */

/**
 * Create a workflow instance.
 *
 * @param {{ id: string }} opts
 * @returns {object} Workflow with addStep/run/getStatus
 */
export function createWorkflow({ id }) {
  const steps = [];
  let state = 'pending';
  let failedStep = null;
  const stepResults = [];

  function addStep({ id: stepId, handler }) {
    steps.push({ id: stepId, handler });
  }

  function run(context = {}) {
    state = 'running';
    failedStep = null;

    for (const step of steps) {
      const result = step.handler(context);
      stepResults.push({ stepId: step.id, ...result });

      if (!result.ok) {
        state = 'failed';
        failedStep = step.id;
        return { completed: false, failedStep: step.id, error: result.error, stepResults: [...stepResults] };
      }
    }

    state = 'completed';
    return { completed: true, stepResults: [...stepResults] };
  }

  function getStatus() {
    return { id, state, failedStep, stepsCount: steps.length, completedSteps: stepResults.length };
  }

  return { addStep, run, getStatus };
}
