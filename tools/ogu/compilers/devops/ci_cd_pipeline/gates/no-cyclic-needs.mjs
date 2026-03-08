/**
 * Gate: no-cyclic-needs (CIP004)
 * Detects cyclic job dependencies in the pipeline DAG. Cycles cause the pipeline to
 * deadlock — every job in the cycle is waiting for another job in the cycle to finish
 * first, so the pipeline never progresses. Reports the full cycle path for easy diagnosis.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

/** @param {Map<string, string[]>} graph @returns {string[]|null} cycle path or null */
function findCycle(graph) {
  const visited = new Set();
  const inStack = [];

  function dfs(node) {
    if (inStack.includes(node)) {
      const idx = inStack.indexOf(node);
      return [...inStack.slice(idx), node];
    }
    if (visited.has(node)) return null;
    visited.add(node);
    inStack.push(node);
    for (const neighbor of (graph.get(node) || [])) {
      const cycle = dfs(neighbor);
      if (cycle) return cycle;
    }
    inStack.pop();
    return null;
  }

  for (const node of graph.keys()) {
    visited.clear();
    inStack.length = 0;
    const cycle = dfs(node);
    if (cycle) return cycle;
  }
  return null;
}

export async function run({ dir }) {
  const spec  = JSON.parse(readFileSync(join(dir, 'ci-cd-spec.json'), 'utf8'));
  const graph = new Map();

  for (const job of spec.jobs) {
    const deps = (job.needs ? (Array.isArray(job.needs) ? job.needs : [job.needs]) : [])
      .map(d => typeof d === 'string' ? d : d.job);
    graph.set(job.name, deps);
  }

  const cycle = findCycle(graph);
  if (cycle) {
    return {
      pass: false, code: 'CIP004',
      message: `Cyclic job dependency detected`,
      detail: {
        cycle: cycle.join(' → '),
        hint: 'Remove the circular dependency. Every job must eventually resolve to a job with no needs.',
      },
    };
  }

  return { pass: true, code: 'CIP004', message: `No cyclic job dependencies (${spec.jobs.length} jobs checked)` };
}
