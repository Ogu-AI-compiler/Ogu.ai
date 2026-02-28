import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { repoRoot } from '../util.mjs';

/**
 * Session Manager — tracks agent execution sessions.
 *
 * Storage: .ogu/sessions/{sessionId}.json
 *
 * ogu session:list [--feature <slug>] [--json]
 */

const SESSIONS_DIR = () => join(repoRoot(), '.ogu/sessions');

/**
 * Create a new session record (called programmatically from agent:run).
 */
export function createSession({ featureSlug, taskId, roleId, model, provider }) {
  const dir = SESSIONS_DIR();
  mkdirSync(dir, { recursive: true });

  const session = {
    sessionId: randomUUID(),
    featureSlug,
    taskId,
    roleId,
    model,
    provider,
    startedAt: new Date().toISOString(),
    status: 'active',
  };

  writeFileSync(join(dir, `${session.sessionId}.json`), JSON.stringify(session, null, 2), 'utf8');
  return session;
}

/**
 * Mark a session as completed.
 */
export function completeSession(sessionId) {
  const dir = SESSIONS_DIR();
  const filePath = join(dir, `${sessionId}.json`);
  if (!existsSync(filePath)) return;

  const session = JSON.parse(readFileSync(filePath, 'utf8'));
  session.status = 'completed';
  session.completedAt = new Date().toISOString();
  writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
}

/**
 * CLI: ogu session:list [--feature <slug>] [--json]
 */
export async function sessionList() {
  const args = process.argv.slice(3);
  let feature = null, jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--feature' && args[i + 1]) feature = args[++i];
    else if (args[i] === '--json') jsonOutput = true;
  }

  const dir = SESSIONS_DIR();
  if (!existsSync(dir)) {
    if (jsonOutput) console.log('[]');
    else console.log('No sessions.');
    return 0;
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  let sessions = files.map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')));

  if (feature) {
    sessions = sessions.filter(s => s.featureSlug === feature);
  }

  sessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

  if (jsonOutput) {
    console.log(JSON.stringify(sessions, null, 2));
  } else {
    console.log(`Sessions${feature ? ` for "${feature}"` : ''}: ${sessions.length}`);
    for (const s of sessions) {
      console.log(`  ${s.sessionId.slice(0, 8)} | ${s.roleId} | ${s.taskId} | ${s.status}`);
    }
  }

  return 0;
}
