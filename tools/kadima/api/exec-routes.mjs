/**
 * Exec routes — CLI command execution, gates, shell, theme, upload.
 * Part of the Kadima API.
 *
 * Handles:
 *   POST /api/exec/command/sync   — synchronous CLI command
 *   POST /api/exec/gates/run      — run gates for a feature
 *   POST /api/exec/gates/reset    — reset gates for a feature
 *   POST /api/exec/features       — create a feature
 *   POST /api/exec/features/:slug/switch — switch active feature
 *   POST /api/exec/shell          — arbitrary bash command (30s timeout)
 *   POST /api/exec/theme/set      — set theme mood
 *   POST /api/exec/upload         — upload a file
 *
 * Note: POST /api/exec/command (async) is intentionally omitted —
 *       Kadima already has POST /api/command which is equivalent.
 */

import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { getUploadsDir } from '../../ogu/commands/lib/runtime-paths.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getCliPath() {
  return resolve(__dirname, '..', '..', '..', 'ogu', 'cli.mjs');
}

let _jobCounter = 0;
const _jobs = new Map(); // jobId → { exitCode, output[] }

function runCommand(root, broadcaster, command, args = []) {
  const jobId = `job-${++_jobCounter}`;
  const cli = getCliPath();
  const output = [];
  _jobs.set(jobId, { exitCode: null, output });

  const child = spawn('node', [cli, command, ...args], {
    cwd: root,
    env: { ...process.env, OGU_ROOT: root },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    const line = chunk.toString();
    output.push(line);
    broadcaster.broadcast({ type: 'command:output', payload: { jobId, stream: 'stdout', data: line } });
  });
  child.stderr.on('data', (chunk) => {
    const line = chunk.toString();
    output.push(line);
    broadcaster.broadcast({ type: 'command:output', payload: { jobId, stream: 'stderr', data: line } });
  });
  child.on('close', (code) => {
    const job = _jobs.get(jobId);
    if (job) job.exitCode = code ?? 1;
    broadcaster.broadcast({ type: 'command:complete', payload: { jobId, exitCode: code ?? 1 } });
  });

  return jobId;
}

function runSync(root, command, args = []) {
  return new Promise((resolve_) => {
    const cli = getCliPath();
    const chunks = [];
    const child = spawn('node', [cli, command, ...args], {
      cwd: root,
      env: { ...process.env, OGU_ROOT: root },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => chunks.push(d.toString()));
    child.stderr.on('data', (d) => chunks.push(d.toString()));
    child.on('close', (code) => resolve_({ exitCode: code ?? 1, stdout: chunks.join('') }));
    setTimeout(() => { child.kill(); resolve_({ exitCode: 1, stdout: 'Timeout after 30s' }); }, 30000);
  });
}

/**
 * Handle exec routes. Returns true if the request was handled.
 */
export async function handleExecRoutes(url, method, readBody, res, root, broadcaster, json) {
  if (method !== 'POST') return false;

  // POST /api/exec/command/sync
  if (url.pathname === '/api/exec/command/sync') {
    const body = await readBody();
    const { command, args = [] } = body;
    if (!command) { json(res, 400, { error: 'command is required' }); return true; }
    const result = await runSync(root, command, Array.isArray(args) ? args : [args]);
    json(res, 200, result);
    return true;
  }

  // POST /api/exec/gates/run
  if (url.pathname === '/api/exec/gates/run') {
    const body = await readBody();
    const { slug, force, gate } = body;
    const args = ['run', slug];
    if (force) args.push('--force');
    if (gate != null) args.push('--gate', String(gate));
    const jobId = runCommand(root, broadcaster, 'gates', args);
    json(res, 200, { jobId });
    return true;
  }

  // POST /api/exec/gates/reset
  if (url.pathname === '/api/exec/gates/reset') {
    const body = await readBody();
    const { slug } = body;
    const jobId = runCommand(root, broadcaster, 'gates', ['reset', slug]);
    json(res, 200, { jobId });
    return true;
  }

  // POST /api/exec/features
  if (url.pathname === '/api/exec/features') {
    const body = await readBody();
    const { slug } = body;
    if (!slug) { json(res, 400, { error: 'slug is required' }); return true; }
    const jobId = runCommand(root, broadcaster, 'feature:create', [slug]);
    json(res, 200, { jobId });
    return true;
  }

  // POST /api/exec/features/:slug/switch
  const switchMatch = url.pathname.match(/^\/api\/exec\/features\/([^/]+)\/switch$/);
  if (switchMatch) {
    const slug = switchMatch[1];
    const jobId = runCommand(root, broadcaster, 'switch', [slug]);
    json(res, 200, { jobId });
    return true;
  }

  // POST /api/exec/shell
  if (url.pathname === '/api/exec/shell') {
    const body = await readBody();
    const { cmd } = body;
    if (!cmd) { json(res, 400, { error: 'cmd is required' }); return true; }

    const result = await new Promise((resolve_) => {
      const stdoutChunks = [];
      const stderrChunks = [];
      const child = spawn('bash', ['-c', cmd], {
        cwd: root,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (d) => stdoutChunks.push(d.toString()));
      child.stderr.on('data', (d) => stderrChunks.push(d.toString()));
      child.on('close', (code) => resolve_({ exitCode: code ?? 1, stdout: stdoutChunks.join(''), stderr: stderrChunks.join('') }));
      setTimeout(() => { child.kill(); resolve_({ exitCode: 1, stdout: stdoutChunks.join(''), stderr: 'Command timed out after 30 seconds' }); }, 30000);
    });

    json(res, 200, result);
    return true;
  }

  // POST /api/exec/theme/set
  if (url.pathname === '/api/exec/theme/set') {
    const body = await readBody();
    const { mood } = body;
    if (!mood) { json(res, 400, { error: 'mood is required' }); return true; }
    const result = await runSync(root, 'theme', ['set', mood]);
    if (result.exitCode === 0) await runSync(root, 'theme', ['apply']);
    json(res, 200, result);
    return true;
  }

  // POST /api/exec/upload — multipart not supported in raw Node.js easily;
  // parse the raw body as a fallback for JSON uploads { name, base64 }
  if (url.pathname === '/api/exec/upload') {
    const body = await readBody();
    const { name, base64, content } = body;
    if (!name) { json(res, 400, { error: 'name is required' }); return true; }

    const uploadDir = getUploadsDir(root);
    mkdirSync(uploadDir, { recursive: true });

    const filePath = join(uploadDir, name);
    if (base64) {
      const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
      writeFileSync(filePath, buffer);
    } else if (content) {
      writeFileSync(filePath, content, 'utf-8');
    } else {
      json(res, 400, { error: 'base64 or content is required' });
      return true;
    }

    json(res, 200, { path: filePath, name });
    return true;
  }

  return false;
}
