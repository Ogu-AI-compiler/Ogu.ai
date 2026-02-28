/**
 * Agent Identity Runtime — formal agent identity, session binding,
 * capability validation, revocation, and quarantine.
 *
 * Every agent operates with a formal AgentId: {orgId}:{roleId}:{instanceId}
 * Sessions bind agents to tasks and features.
 * Revocation = immediate halt + quarantine outputs.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';

const SESSIONS_DIR = (root) => join(root, '.ogu/agents/sessions');
const CREDENTIALS_DIR = (root) => join(root, '.ogu/agents/credentials');
const REVOKED_DIR = (root) => join(root, '.ogu/agents/revoked');
const QUARANTINE_DIR = (root) => join(root, '.ogu/quarantine');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// ── AgentId Construction ────────────────────────────────────────────────

function hashShort(input) {
  return createHash('sha256').update(String(input)).digest('hex').slice(0, 8);
}

function hashFull(input) {
  return 'sha256:' + createHash('sha256').update(String(input)).digest('hex').slice(0, 16);
}

function loadOrgSpec(root) {
  const path = join(root, '.ogu/OrgSpec.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Create a new agent identity bound to a role.
 */
export function createIdentity(root, roleId) {
  root = root || repoRoot();
  const orgSpec = loadOrgSpec(root);
  if (!orgSpec) throw new Error('OGU3900: OrgSpec not found');

  const role = (orgSpec.roles || []).find(r => r.roleId === roleId || r.id === roleId);
  if (!role) throw new Error(`OGU3901: Role '${roleId}' not found in OrgSpec`);

  const orgId = hashShort((orgSpec.org?.name || 'ogu') + (orgSpec.org?.version || '1'));
  const instanceId = hashShort(roleId + Date.now() + randomBytes(8).toString('hex'));
  const agentId = `${orgId}:${roleId}:${instanceId}`;

  const credential = {
    $schema: 'AgentIdentity/1.0',
    agentId,
    roleId,
    boundTo: {
      orgVersion: orgSpec.org?.version || '1.0.0',
      orgHash: hashFull(JSON.stringify(orgSpec.org || {})),
      roleHash: hashFull(JSON.stringify(role)),
    },
    issued: new Date().toISOString(),
    expires: null,
    session: null,
    capabilities: role.capabilities || [],
    permissions: {
      tools: role.allowedTools || [],
      commands: role.allowedCommands || [],
      paths: role.ownershipScope || [],
      secrets: role.allowedSecrets || [],
    },
    signature: null,
  };

  credential.signature = signCredential(credential, root);

  const dir = ensureDir(CREDENTIALS_DIR(root));
  writeFileSync(join(dir, `${agentId.replace(/:/g, '_')}.json`), JSON.stringify(credential, null, 2));

  emitAudit('agent.identity_created', {
    agentId,
    roleId,
    orgVersion: credential.boundTo.orgVersion,
  }, { agent: { agentId, roleId } });

  return credential;
}

/**
 * Load an agent credential.
 */
export function loadCredential(root, agentId) {
  root = root || repoRoot();
  const path = join(CREDENTIALS_DIR(root), `${agentId.replace(/:/g, '_')}.json`);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function saveCredential(root, agentId, credential) {
  const dir = ensureDir(CREDENTIALS_DIR(root));
  writeFileSync(join(dir, `${agentId.replace(/:/g, '_')}.json`), JSON.stringify(credential, null, 2));
}

// ── Session Management ──────────────────────────────────────────────────

/**
 * Create a new agent session (legacy compat).
 */
export function createSession({ roleId, featureSlug, taskId, root } = {}) {
  root = root || repoRoot();

  const active = getActiveSession({ roleId, root });
  if (active) {
    throw new Error(`Role "${roleId}" already has an active session: ${active.sessionId}`);
  }

  const sessionId = randomUUID();
  const session = {
    sessionId,
    roleId,
    featureSlug,
    taskId,
    status: 'active',
    state: 'active',
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    endedAt: null,
  };

  const dir = ensureDir(SESSIONS_DIR(root));
  writeFileSync(join(dir, `${sessionId}.json`), JSON.stringify(session, null, 2));
  return session;
}

/**
 * Start session for an agent identity (v2 — binds to credential).
 */
export function startSession(root, agentId, { taskId, featureSlug }) {
  root = root || repoRoot();
  const credential = loadCredential(root, agentId);
  if (!credential) throw new Error(`OGU3902: Agent '${agentId}' not found`);

  if (isRevoked(root, agentId)) {
    throw new Error(`OGU3903: Agent '${agentId}' has been revoked`);
  }

  if (credential.expires && new Date(credential.expires) < new Date()) {
    throw new Error(`OGU3904: Agent '${agentId}' credential expired`);
  }

  // Check if role still valid in OrgSpec
  const orgSpec = loadOrgSpec(root);
  if (orgSpec) {
    const currentRole = (orgSpec.roles || []).find(r => r.roleId === credential.roleId || r.id === credential.roleId);
    if (currentRole) {
      const currentRoleHash = hashFull(JSON.stringify(currentRole));
      if (currentRoleHash !== credential.boundTo.roleHash) {
        throw new Error(`OGU3905: Role '${credential.roleId}' has changed since agent was created. Re-create identity.`);
      }
    }
  }

  const sessionId = randomBytes(16).toString('hex');
  credential.session = {
    sessionId,
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    taskId,
    featureSlug,
    state: 'active',
  };

  saveCredential(root, agentId, credential);

  emitAudit('agent.session_started', {
    agentId,
    sessionId,
    taskId,
    featureSlug,
  }, { agent: { agentId, roleId: credential.roleId } });

  return credential.session;
}

/**
 * Validate that a session's role has a required capability.
 */
export function validateCapability({ session, capability, root } = {}) {
  root = root || repoRoot();
  const orgSpec = loadOrgSpec(root);
  if (!orgSpec) return { valid: false, reason: 'OrgSpec not found' };

  const role = (orgSpec.roles || []).find(r => r.id === session.roleId || r.roleId === session.roleId);
  if (!role) return { valid: false, reason: `Role not found: ${session.roleId}` };
  if (role.enabled === false) return { valid: false, reason: `Role disabled: ${session.roleId}` };

  const caps = role.capabilities || [];
  if (caps.includes(capability)) return { valid: true, reason: 'capability matched' };
  return { valid: false, reason: `Role "${session.roleId}" lacks capability "${capability}"` };
}

/**
 * End a session.
 */
export function endSession({ sessionId, status, root } = {}) {
  root = root || repoRoot();
  const dir = SESSIONS_DIR(root);
  const filePath = join(dir, `${sessionId}.json`);

  if (existsSync(filePath)) {
    const session = JSON.parse(readFileSync(filePath, 'utf8'));
    session.status = status || 'completed';
    session.state = status || 'completed';
    session.endedAt = new Date().toISOString();
    writeFileSync(filePath, JSON.stringify(session, null, 2));
    return session;
  }

  return null;
}

/**
 * Get the active session for a role.
 */
export function getActiveSession({ roleId, root } = {}) {
  root = root || repoRoot();
  const dir = SESSIONS_DIR(root);
  if (!existsSync(dir)) return null;

  for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    try {
      const session = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      if (session.roleId === roleId && (session.status === 'active' || session.state === 'active')) {
        return session;
      }
    } catch { /* skip */ }
  }

  return null;
}

// ── Revocation ──────────────────────────────────────────────────────────

/**
 * Revoke agent identity.
 */
export function revokeAgent(root, agentId, { reason, revokedBy } = {}) {
  root = root || repoRoot();
  const credential = loadCredential(root, agentId);

  const revocation = {
    agentId,
    revokedAt: new Date().toISOString(),
    reason: reason || 'unspecified',
    revokedBy: revokedBy || 'system',
    quarantinedOutputs: [],
  };

  const dir = ensureDir(REVOKED_DIR(root));
  writeFileSync(join(dir, `${agentId.replace(/:/g, '_')}.json`), JSON.stringify(revocation, null, 2));

  emitAudit('agent.revoked', {
    agentId,
    reason,
    revokedBy,
  }, { agent: { agentId, roleId: credential?.roleId || 'unknown' } });

  return revocation;
}

/**
 * Check if agent is revoked.
 */
export function isRevoked(root, agentId) {
  root = root || repoRoot();
  return existsSync(join(REVOKED_DIR(root), `${agentId.replace(/:/g, '_')}.json`));
}

/**
 * Verify agent credential.
 */
export function verifyCredential(root, agentId, signature) {
  root = root || repoRoot();
  const credential = loadCredential(root, agentId);
  if (!credential) return { valid: false, error: 'Agent not found' };
  if (isRevoked(root, agentId)) return { valid: false, error: 'Agent revoked' };

  if (signature) {
    const expectedSig = signCredential(credential, root);
    if (signature !== expectedSig) return { valid: false, error: 'Signature mismatch' };
  }

  return { valid: true, credential };
}

/**
 * Check session liveness.
 */
export function checkSessionHealth(root, agentId) {
  root = root || repoRoot();
  const credential = loadCredential(root, agentId);
  if (!credential?.session) return { alive: false, reason: 'no_session' };

  const session = credential.session;
  const now = Date.now();
  const started = new Date(session.startedAt).getTime();
  const lastActivity = session.lastActivityAt ? new Date(session.lastActivityAt).getTime() : started;
  const idle = now - lastActivity;

  // Check idle timeout (1h)
  if (session.state === 'idle' && idle > 3600000) {
    return { alive: false, reason: 'idle_timeout' };
  }

  // Check max duration (24h)
  if (now - started > 86400000) {
    return { alive: false, reason: 'max_duration' };
  }

  return { alive: true, state: session.state, idleMs: idle };
}

/**
 * List all active agent sessions.
 */
export function listActiveSessions(root) {
  root = root || repoRoot();
  const sessions = [];

  // From sessions dir
  const dir = SESSIONS_DIR(root);
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try {
        const session = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        if (session.status === 'active' || session.state === 'active') {
          sessions.push(session);
        }
      } catch { /* skip */ }
    }
  }

  // From credentials dir
  const credDir = CREDENTIALS_DIR(root);
  if (existsSync(credDir)) {
    for (const f of readdirSync(credDir).filter(f => f.endsWith('.json'))) {
      try {
        const cred = JSON.parse(readFileSync(join(credDir, f), 'utf8'));
        if (cred.session?.state === 'active') {
          sessions.push({
            agentId: cred.agentId,
            roleId: cred.roleId,
            ...cred.session,
          });
        }
      } catch { /* skip */ }
    }
  }

  return sessions;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function signCredential(credential, root) {
  const secret = getOrgSecret(root);
  const payload = (credential.agentId || '') + (credential.roleId || '') + (credential.boundTo?.orgHash || '') + (credential.session?.sessionId || '');
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function getOrgSecret(root) {
  // Derive secret from OrgSpec hash (no external secrets for local mode)
  const orgPath = join(root, '.ogu/OrgSpec.json');
  if (existsSync(orgPath)) {
    const content = readFileSync(orgPath, 'utf8');
    return createHash('sha256').update(content).digest('hex');
  }
  return 'ogu-local-secret-' + hashShort(root);
}
