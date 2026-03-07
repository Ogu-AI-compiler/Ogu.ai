import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';
import { getRunnersDir } from './lib/runtime-paths.mjs';

/**
 * ogu build:status <slug> [--json] — Show build progress for a feature.
 *
 * Reads scheduler state and runner outputs to show per-task status.
 */
export async function buildStatus() {
  const args = process.argv.slice(3);
  let slug = null;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') jsonOutput = true;
    else if (!args[i].startsWith('-')) slug = args[i];
  }

  if (!slug) {
    console.error('Usage: ogu build:status <feature-slug> [--json]');
    return 1;
  }

  const root = repoRoot();

  // Load scheduler state
  const statePath = join(root, '.ogu/state/scheduler-state.json');
  if (!existsSync(statePath)) {
    console.error('No scheduler state found. Has build:dispatch been run?');
    return 1;
  }

  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  const tasks = state.queue.filter(t => t.featureSlug === slug);

  if (tasks.length === 0) {
    console.error(`No tasks found for feature "${slug}".`);
    return 1;
  }

  // Load feature state
  const featureStatePath = join(root, `.ogu/state/features/${slug}.state.json`);
  let featurePhase = 'unknown';
  if (existsSync(featureStatePath)) {
    const featureState = JSON.parse(readFileSync(featureStatePath, 'utf8'));
    featurePhase = featureState.currentState;
  }

  // Count files created across all output envelopes
  let totalFilesCreated = 0;
  const taskStatuses = tasks.map(t => {
    const outputPath = join(getRunnersDir(root), `${t.taskId}.output.json`);
    let filesCreated = 0;
    if (existsSync(outputPath)) {
      const output = JSON.parse(readFileSync(outputPath, 'utf8'));
      filesCreated = (output.files || []).length;
      totalFilesCreated += filesCreated;
    }
    return {
      taskId: t.taskId,
      status: t.status,
      filesCreated,
      enqueuedAt: t.enqueuedAt,
      completedAt: t.completedAt,
    };
  });

  const completed = tasks.filter(t => t.status === 'completed').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const dispatched = tasks.filter(t => t.status === 'dispatched').length;

  if (jsonOutput) {
    console.log(JSON.stringify({
      featureSlug: slug,
      featurePhase,
      tasks: taskStatuses,
      summary: { total: tasks.length, completed, pending, dispatched },
      filesCreated: totalFilesCreated,
    }, null, 2));
    return 0;
  }

  console.log(`Feature: ${slug} (${featurePhase})`);
  console.log(`Tasks: ${completed}/${tasks.length} completed`);
  console.log(`Files created: ${totalFilesCreated}`);
  console.log('');

  for (const t of taskStatuses) {
    const icon = t.status === 'completed' ? '✓' : t.status === 'dispatched' ? '→' : '○';
    console.log(`  ${icon} ${t.taskId}: ${t.status}${t.filesCreated ? ` (${t.filesCreated} files)` : ''}`);
  }

  return 0;
}
