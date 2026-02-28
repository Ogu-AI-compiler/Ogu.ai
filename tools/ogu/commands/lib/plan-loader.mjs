/**
 * Plan Loader — centralized Plan.json loading and validation.
 *
 * Plan.json lives at: docs/vault/features/{slug}/Plan.json
 * (or legacy: docs/vault/04_Features/{slug}/Plan.json)
 *
 * Functions:
 *   loadPlan(slug, root?)       — Load Plan.json for a feature
 *   getPlanTask(slug, taskId)   — Get a specific task from Plan.json
 *   getPlanTasks(slug)          — Get all tasks from Plan.json
 *   validatePlan(plan)          — Validate Plan.json structure
 *   getPlanPath(slug, root?)    — Resolve Plan.json path (checks both locations)
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Resolve the path to Plan.json for a feature.
 * Checks both current and legacy vault locations.
 *
 * @param {string} slug — feature slug
 * @param {string} [root] — override repo root
 * @returns {string|null} — path to Plan.json or null if not found
 */
export function getPlanPath(slug, root = null) {
  const r = root || repoRoot();
  const paths = [
    join(r, `docs/vault/features/${slug}/Plan.json`),
    join(r, `docs/vault/04_Features/${slug}/Plan.json`),
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Load Plan.json for a feature.
 *
 * @param {string} slug — feature slug
 * @param {string} [root] — override repo root
 * @returns {object|null} — parsed Plan.json or null if not found/invalid
 */
export function loadPlan(slug, root = null) {
  const path = getPlanPath(slug, root);
  if (!path) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Get a specific task from Plan.json.
 *
 * @param {string} slug — feature slug
 * @param {string} taskId — task ID to find
 * @param {string} [root]
 * @returns {object|null} — task object or null
 */
export function getPlanTask(slug, taskId, root = null) {
  const plan = loadPlan(slug, root);
  if (!plan || !plan.tasks) return null;
  return plan.tasks.find(t => t.id === taskId) || null;
}

/**
 * Get all tasks from Plan.json.
 *
 * @param {string} slug — feature slug
 * @param {string} [root]
 * @returns {object[]} — array of tasks (empty if not found)
 */
export function getPlanTasks(slug, root = null) {
  const plan = loadPlan(slug, root);
  if (!plan || !plan.tasks) return [];
  return plan.tasks;
}

/**
 * Validate Plan.json structure.
 *
 * @param {object} plan — parsed Plan.json
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePlan(plan) {
  const errors = [];

  if (!plan) {
    errors.push('Plan is null or undefined');
    return { valid: false, errors };
  }

  if (!Array.isArray(plan.tasks)) {
    errors.push('Plan.tasks must be an array');
  } else {
    const ids = new Set();
    for (let i = 0; i < plan.tasks.length; i++) {
      const task = plan.tasks[i];
      if (!task.id) errors.push(`Task at index ${i} missing "id"`);
      if (!task.name && !task.title) errors.push(`Task "${task.id || i}" missing "name" or "title"`);
      if (task.id && ids.has(task.id)) errors.push(`Duplicate task ID: "${task.id}"`);
      if (task.id) ids.add(task.id);

      // Validate dependencies exist
      if (Array.isArray(task.dependsOn)) {
        for (const dep of task.dependsOn) {
          if (!ids.has(dep) && !plan.tasks.some(t => t.id === dep)) {
            errors.push(`Task "${task.id}" depends on "${dep}" which is not in the plan`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
