/**
 * compiler-registry.mjs
 * Registry for domain compilers — one per agent role.
 *
 * Storage:
 *   .ogu/compilers/index.json              — fast lookup index
 *   .ogu/compilers/{role}/compiler.json    — compiler definition (gates, handoff spec, rules)
 *   .ogu/compilers/{role}/benchmarks.jsonl — gate pass/fail history
 *   .ogu/compilers/{role}/evolution.jsonl  — version change log
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';

function compilersDir(root) {
  return join(root, '.ogu', 'compilers');
}

function compilerDir(root, role) {
  return join(compilersDir(root), role);
}

function indexPath(root) {
  return join(compilersDir(root), 'index.json');
}

function ensureDir(root, role) {
  mkdirSync(compilerDir(root, role), { recursive: true });
}

function readIndex(root) {
  const p = indexPath(root);
  if (!existsSync(p)) return { compilers: [] };
  try { return JSON.parse(readFileSync(p, 'utf-8')); }
  catch { return { compilers: [] }; }
}

function writeIndex(root, idx) {
  mkdirSync(compilersDir(root), { recursive: true });
  writeFileSync(indexPath(root), JSON.stringify(idx, null, 2) + '\n', 'utf-8');
}

/**
 * registerCompiler(root, role, def)
 *
 * Registers a domain compiler for a role. Creates compiler.json and updates index.
 * If the compiler already exists, bumps the version and logs to evolution.jsonl.
 *
 * @param {string} root - Project root
 * @param {string} role - Role slug (e.g. 'qa-engineer')
 * @param {object} def  - Compiler definition (gates, handoff, rules, etc.)
 * @returns {object} The registered compiler record
 */
export function registerCompiler(root, role, def) {
  ensureDir(root, role);

  const compilerPath = join(compilerDir(root, role), 'compiler.json');
  const existing = getCompiler(root, role);

  const version = existing
    ? _bumpVersion(existing.version)
    : '1.0.0';

  const compiler = {
    compiler_id: existing?.compiler_id ?? `compiler_${role}`,
    role,
    version,
    registered_at: existing?.registered_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...def,
  };

  writeFileSync(compilerPath, JSON.stringify(compiler, null, 2) + '\n', 'utf-8');

  // Log evolution
  if (existing) {
    _appendEvolution(root, role, {
      from_version: existing.version,
      to_version: version,
      reason: def._change_reason ?? 'manual update',
      changed_at: compiler.updated_at,
    });
  }

  // Update index
  const idx = readIndex(root);
  const entry = { role, version, updated_at: compiler.updated_at };
  const i = idx.compilers.findIndex(c => c.role === role);
  if (i >= 0) idx.compilers[i] = entry;
  else idx.compilers.push(entry);
  writeIndex(root, idx);

  return compiler;
}

/**
 * getCompiler(root, role) → compiler | null
 */
export function getCompiler(root, role) {
  const p = join(compilerDir(root, role), 'compiler.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); }
  catch { return null; }
}

/**
 * listCompilers(root) → [{ role, version, updated_at }]
 */
export function listCompilers(root) {
  return readIndex(root).compilers;
}

/**
 * hasCompiler(root, role) → boolean
 */
export function hasCompiler(root, role) {
  return existsSync(join(compilerDir(root, role), 'compiler.json'));
}

/**
 * recordBenchmark(root, role, result)
 *
 * Appends a gate execution result to benchmarks.jsonl.
 *
 * @param {string} root
 * @param {string} role
 * @param {object} result - { taskId, featureSlug, gates, passed, duration_ms }
 */
export function recordBenchmark(root, role, result) {
  ensureDir(root, role);
  const line = JSON.stringify({
    id: randomUUID(),
    role,
    timestamp: new Date().toISOString(),
    ...result,
  });
  appendFileSync(
    join(compilerDir(root, role), 'benchmarks.jsonl'),
    line + '\n',
    'utf-8',
  );
}

/**
 * getBenchmarkStats(root, role) → { total, passed, failed, pass_rate, avg_duration_ms }
 */
export function getBenchmarkStats(root, role) {
  const p = join(compilerDir(root, role), 'benchmarks.jsonl');
  if (!existsSync(p)) return { total: 0, passed: 0, failed: 0, pass_rate: 0, avg_duration_ms: 0 };

  const lines = readFileSync(p, 'utf-8').trim().split('\n').filter(Boolean);
  const records = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

  const total = records.length;
  const passed = records.filter(r => r.passed).length;
  const failed = total - passed;
  const pass_rate = total > 0 ? Math.round((passed / total) * 100) / 100 : 0;
  const avg_duration_ms = total > 0
    ? Math.round(records.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / total)
    : 0;

  return { total, passed, failed, pass_rate, avg_duration_ms };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _bumpVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

function _appendEvolution(root, role, entry) {
  appendFileSync(
    join(compilerDir(root, role), 'evolution.jsonl'),
    JSON.stringify({ ...entry, id: randomUUID() }) + '\n',
    'utf-8',
  );
}
