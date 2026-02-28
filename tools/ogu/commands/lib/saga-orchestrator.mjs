/**
 * Saga Orchestrator — execute steps with compensating rollback on failure.
 */
export function createSagaOrchestrator() {
  const steps = [];
  let status = 'pending';
  function addStep(step) { steps.push(step); }
  function run() {
    const executed = [];
    try {
      for (const step of steps) {
        step.execute();
        executed.push(step);
      }
      status = 'completed';
    } catch {
      status = 'compensated';
      for (let i = executed.length - 1; i >= 0; i--) {
        try { executed[i].compensate(); } catch {}
      }
    }
  }
  function getStatus() { return status; }
  return { addStep, run, getStatus };
}
