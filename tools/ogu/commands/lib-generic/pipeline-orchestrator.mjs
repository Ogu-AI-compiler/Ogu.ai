/**
 * Pipeline Orchestrator — end-to-end pipeline execution with agent assignment.
 */

import { createWaveExecutor } from './wave-executor.mjs';

/**
 * Create a pipeline orchestrator.
 *
 * @returns {object} Orchestrator with definePhase/execute/getProgress/listPhases
 */
export function createPipelineOrchestrator() {
  const phases = new Map(); // name → { agent, run, deps }
  let completedPhases = [];
  let failedPhase = null;
  let phaseResults = {};

  function definePhase(name, { agent, run, deps = [] }) {
    phases.set(name, { name, agent, run, deps });
  }

  function listPhases() {
    return Array.from(phases.keys());
  }

  function getProgress() {
    return {
      total: phases.size,
      completed: completedPhases.length,
      failedPhase,
      phaseResults,
    };
  }

  async function execute() {
    const executor = createWaveExecutor();
    for (const [name, phase] of phases) {
      executor.addTask(name, { run: phase.run, deps: phase.deps });
    }

    const result = await executor.execute();

    completedPhases = Object.keys(result.results);
    phaseResults = result.results;

    if (result.status === 'failed') {
      failedPhase = Object.keys(result.errors)[0];
      return {
        status: 'failed',
        failedPhase,
        completedPhases,
        errors: result.errors,
      };
    }

    return {
      status: 'completed',
      completedPhases,
      results: result.results,
    };
  }

  return { definePhase, execute, getProgress, listPhases };
}
