/**
 * AoaS Org Store — team/org membership management.
 */
import { readTable, writeTable, randomUUID } from './db.mjs';
import { createHmac, randomBytes } from 'crypto';

function generateInviteToken() {
  return randomBytes(24).toString('hex');
}

/**
 * Invite a member to an org by email.
 * Returns the invite token (sent via email in production).
 */
export function inviteMember(orgId, email, role = 'member') {
  if (!orgId || !email) throw new Error('orgId and email are required');
  const invites = readTable('invites');
  // Check for existing pending invite
  const existing = invites.find(i => i.org_id === orgId && i.email === email.toLowerCase() && !i.accepted);
  if (existing) return existing.token; // Re-send same token
  const token = generateInviteToken();
  invites.push({
    token,
    org_id: orgId,
    email: email.toLowerCase(),
    role,
    created_at: new Date().toISOString(),
    accepted: false,
    accepted_at: null,
  });
  writeTable('invites', invites);
  return token;
}

/**
 * Accept an invite token — adds userId to org.
 */
export function acceptInvite(token, userId) {
  const invites = readTable('invites');
  const idx = invites.findIndex(i => i.token === token && !i.accepted);
  if (idx < 0) throw new Error('Invalid or already used invite token');
  const invite = invites[idx];
  // Add org member
  const members = readTable('org_members');
  const existing = members.find(m => m.org_id === invite.org_id && m.user_id === userId);
  if (!existing) {
    members.push({ org_id: invite.org_id, user_id: userId, role: invite.role });
    writeTable('org_members', members);
  }
  // Update user's org_id
  const users = readTable('users');
  const uIdx = users.findIndex(u => u.id === userId);
  if (uIdx >= 0) {
    users[uIdx].org_id = invite.org_id;
    writeTable('users', users);
  }
  // Mark invite accepted
  invites[idx].accepted = true;
  invites[idx].accepted_at = new Date().toISOString();
  writeTable('invites', invites);
  return { orgId: invite.org_id, role: invite.role };
}

/**
 * Remove a member from an org.
 */
export function removeMember(orgId, userId) {
  const members = readTable('org_members');
  writeTable('org_members', members.filter(m => !(m.org_id === orgId && m.user_id === userId)));
}

/**
 * Update a member's role.
 */
export function updateRole(orgId, userId, role) {
  const members = readTable('org_members');
  const idx = members.findIndex(m => m.org_id === orgId && m.user_id === userId);
  if (idx < 0) throw new Error('Member not found');
  members[idx].role = role;
  writeTable('org_members', members);
}

/**
 * List members of an org.
 */
export function listMembers(orgId) {
  const members = readTable('org_members');
  const users = readTable('users');
  return members
    .filter(m => m.org_id === orgId)
    .map(m => {
      const user = users.find(u => u.id === m.user_id);
      return { userId: m.user_id, role: m.role, email: user?.email, name: user?.name };
    });
}

/**
 * Get pending invites for an org.
 */
export function getPendingInvites(orgId) {
  const invites = readTable('invites');
  return invites.filter(i => i.org_id === orgId && !i.accepted);
}
