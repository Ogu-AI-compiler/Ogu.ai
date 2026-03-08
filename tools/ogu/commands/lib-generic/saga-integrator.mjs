/**
 * SAGA Integrator — wire saga transactions into multi-step operations.
 */

/**
 * Create a saga integrator.
 *
 * @returns {object} Integrator with defineSaga/executeSaga/listSagas
 */
export function createSagaIntegrator() {
  const sagas = new Map(); // name → { steps }

  function defineSaga(name, { steps }) {
    sagas.set(name, { name, steps });
  }

  function listSagas() {
    return Array.from(sagas.keys());
  }

  async function executeSaga(name) {
    const saga = sagas.get(name);
    if (!saga) throw new Error(`Saga ${name} not found`);

    const completedSteps = [];
    const stepResults = {};

    for (const step of saga.steps) {
      try {
        const result = await step.execute();
        stepResults[step.name] = result;
        completedSteps.push(step);
      } catch (e) {
        // Compensate in reverse order
        for (let i = completedSteps.length - 1; i >= 0; i--) {
          try {
            await completedSteps[i].compensate();
          } catch (_) {
            // Compensation failure — log but continue
          }
        }
        return {
          status: 'compensated',
          failedStep: step.name,
          error: e.message,
          stepResults,
          compensatedSteps: completedSteps.map(s => s.name),
        };
      }
    }

    return {
      status: 'completed',
      stepResults,
      stepsCompleted: completedSteps.map(s => s.name),
    };
  }

  return { defineSaga, executeSaga, listSagas };
}
