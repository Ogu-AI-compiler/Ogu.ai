import { repoRoot } from '../util.mjs';
import {
  createIdentity, loadCredential, startSession, endSession,
  revokeAgent, verifyCredential, isRevoked,
  listActiveSessions, checkSessionHealth,
} from './lib/agent-identity.mjs';

/**
 * ogu agent:identity <roleId>      — Create identity for a role
 * ogu agent:revoke <agentId>       — Revoke an agent identity
 * ogu agent:sessions               — List active sessions
 * ogu agent:verify <agentId>       — Verify agent credential
 */

export async function agentIdentity() {
  const roleId = process.argv[3];
  if (!roleId) {
    console.error('Usage: ogu agent:identity <roleId>');
    return 1;
  }

  const root = repoRoot();
  try {
    const credential = createIdentity(root, roleId);
    console.log(`\n  Created identity: ${credential.agentId}`);
    console.log(`  Role: ${credential.roleId}`);
    console.log(`  Capabilities: ${credential.capabilities.join(', ')}`);
    console.log(`  Org version: ${credential.boundTo.orgVersion}`);
    console.log(`  Signature: ${credential.signature?.slice(0, 16)}...`);
    return 0;
  } catch (err) {
    console.error(err.message);
    return 1;
  }
}

export async function agentRevoke() {
  const agentId = process.argv[3];
  if (!agentId) {
    console.error('Usage: ogu agent:revoke <agentId>');
    return 1;
  }

  const args = process.argv.slice(4);
  let reason = 'manual revocation';
  const rIdx = args.indexOf('--reason');
  if (rIdx !== -1 && args[rIdx + 1]) reason = args[rIdx + 1];

  const root = repoRoot();
  const revocation = revokeAgent(root, agentId, { reason, revokedBy: process.env.USER || 'cli' });
  console.log(`  Revoked: ${revocation.agentId}`);
  console.log(`  Reason: ${revocation.reason}`);
  return 0;
}

export async function agentSessions() {
  const root = repoRoot();
  const sessions = listActiveSessions(root);

  if (sessions.length === 0) {
    console.log('  No active sessions.');
    return 0;
  }

  console.log(`\n  Active Sessions: ${sessions.length}\n`);
  for (const s of sessions) {
    const id = s.agentId || s.sessionId;
    console.log(`  ${(id || '').padEnd(40)} role=${(s.roleId || '').padEnd(16)} task=${s.taskId || 'none'}`);
  }
  return 0;
}

export async function agentVerify() {
  const agentId = process.argv[3];
  if (!agentId) {
    console.error('Usage: ogu agent:verify <agentId>');
    return 1;
  }

  const root = repoRoot();
  const result = verifyCredential(root, agentId);
  if (result.valid) {
    console.log(`  VALID — ${agentId}`);
    console.log(`  Role: ${result.credential.roleId}`);
    console.log(`  Capabilities: ${result.credential.capabilities.join(', ')}`);
    return 0;
  }
  console.error(`  INVALID — ${result.error}`);
  return 1;
}
