/**
 * Task Splitter — split large tasks into subtasks.
 */

import { randomUUID } from 'node:crypto';

/**
 * Split a task into subtasks.
 *
 * @param {{ id: string, items: any[], maxPerSubtask: number }} opts
 * @returns {Array<{ id: string, parentId: string, items: any[] }>}
 */
export function splitTask({ id, items, maxPerSubtask }) {
  const subtasks = [];
  for (let i = 0; i < items.length; i += maxPerSubtask) {
    subtasks.push({
      id: randomUUID().slice(0, 8),
      parentId: id,
      index: subtasks.length,
      items: items.slice(i, i + maxPerSubtask),
    });
  }
  return subtasks;
}

/**
 * Merge results from multiple subtasks.
 *
 * @param {Array<{ subtaskId: string, output: any[] }>} results
 * @returns {{ output: any[], count: number }}
 */
export function mergeResults(results) {
  const output = [];
  for (const r of results) {
    if (Array.isArray(r.output)) {
      output.push(...r.output);
    }
  }
  return { output, count: results.length };
}
