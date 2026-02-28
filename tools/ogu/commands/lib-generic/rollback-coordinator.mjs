/**
 * Rollback Coordinator — atomic multi-agent rollback via SAGA pattern.
 *
 * Executes steps forward in order. On failure, compensates completed
 * steps in reverse order.
 */

/**
 * Create a rollback coordinator.
 *
 * @returns {object} Coordinator with addStep/execute/getHistory
 */
export function createRollbackCoordinator() {
  const steps = [];
  const history = [];

  function addStep({ name, forward, compensate }) {
    steps.push({ name, forward, compensate });
  }

  async function execute() {
    const completedSteps = [];
    const record = {
      startedAt: Date.now(),
      steps: steps.map(s => s.name),
      status: 'running',
    };

    try {
      for (const step of steps) {
        await step.forward();
        completedSteps.push(step);
      }
      record.status = 'completed';
      record.finishedAt = Date.now();
    } catch (err) {
      record.error = err.message;
      record.failedAt = completedSteps.length;

      // Compensate in reverse order
      const compensationErrors = [];
      for (let i = completedSteps.length - 1; i >= 0; i--) {
        try {
          await completedSteps[i].compensate();
        } catch (compErr) {
          compensationErrors.push({
            step: completedSteps[i].name,
            error: compErr.message,
          });
        }
      }

      record.status = 'rolled_back';
      record.compensationErrors = compensationErrors;
      record.finishedAt = Date.now();
    }

    history.push(record);
    return record;
  }

  function getHistory() {
    return [...history];
  }

  return { addStep, execute, getHistory };
}
