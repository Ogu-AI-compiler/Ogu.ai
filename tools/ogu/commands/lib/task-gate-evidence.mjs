import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getRunnersDir } from './runtime-paths.mjs';

function readJsonSafe(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

export function getGateEvidencePath(root, taskId) {
  return join(getRunnersDir(root), `${taskId}.gates.json`);
}

export function readRunnerOutput(root, taskId) {
  const outputPath = join(getRunnersDir(root), `${taskId}.output.json`);
  if (!existsSync(outputPath)) return null;
  return readJsonSafe(outputPath);
}

export function hasRunnerGatePass(output) {
  if (!output || output.status !== 'success') return false;
  const gates = Array.isArray(output.gateResults) ? output.gateResults : [];
  return gates.some((g) => typeof g?.gate === 'string' && g.gate.startsWith('task-') && g.passed === true);
}

export function readTaskGateEvidence(root, taskId) {
  const path = getGateEvidencePath(root, taskId);
  if (!existsSync(path)) return null;
  return readJsonSafe(path);
}

export function writeTaskGateEvidence(root, taskId, evidence) {
  const dir = getRunnersDir(root);
  mkdirSync(dir, { recursive: true });
  const payload = {
    taskId,
    passed: !!evidence?.passed,
    source: evidence?.source || 'local',
    at: evidence?.at || new Date().toISOString(),
    gateResults: evidence?.gateResults || undefined,
    warnings: evidence?.warnings || undefined,
    errors: evidence?.errors || undefined,
  };
  writeFileSync(getGateEvidencePath(root, taskId), JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

export function hasTaskGateEvidence(root, taskId) {
  const evidence = readTaskGateEvidence(root, taskId);
  if (evidence) return evidence.passed === true;
  const output = readRunnerOutput(root, taskId);
  return hasRunnerGatePass(output);
}

export function getTaskGateStatus(root, taskId) {
  const evidence = readTaskGateEvidence(root, taskId);
  if (evidence) return { passed: !!evidence.passed, source: evidence.source || 'local', evidence };
  const output = readRunnerOutput(root, taskId);
  if (!output) return { passed: false, source: 'none', evidence: null };
  return { passed: hasRunnerGatePass(output), source: 'runner', evidence: output };
}
