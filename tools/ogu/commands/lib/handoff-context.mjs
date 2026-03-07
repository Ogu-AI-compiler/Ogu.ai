import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getContextDir } from './runtime-paths.mjs';

export function buildHandoffKey(taskId) {
  return `task.${taskId}`;
}

function contextFile(root, featureSlug, key) {
  return join(getContextDir(root), featureSlug, `${key}.json`);
}

export function writeHandoffContext(root, featureSlug, taskId, value) {
  if (!root || !featureSlug || !taskId) return null;
  const key = buildHandoffKey(taskId);
  const dir = join(getContextDir(root), featureSlug);
  mkdirSync(dir, { recursive: true });

  const entry = {
    key,
    value,
    writtenAt: new Date().toISOString(),
    writtenBy: 'dispatch',
    sourceTaskId: taskId,
    sourceFeature: featureSlug,
    kind: 'task-handoff',
  };

  writeFileSync(contextFile(root, featureSlug, key), JSON.stringify(entry, null, 2), 'utf8');
  return entry;
}

export function readHandoffContext(root, featureSlug, key) {
  const path = contextFile(root, featureSlug, key);
  if (!existsSync(path)) return null;
  try {
    const entry = JSON.parse(readFileSync(path, 'utf8'));
    return entry?.value ?? null;
  } catch {
    return null;
  }
}
