/**
 * AoaS User Store — CRUD operations on the file-based user table.
 */
import { readTable, writeTable, randomUUID } from './db.mjs';
import { hashPassword } from './password.mjs';

/**
 * Create a new user + default org.
 * Returns the user object (without password_hash).
 */
export function createUser({ email, password, name, orgName }) {
  if (!email || !password || !name) throw new Error('email, password, and name are required');

  const users = readTable('users');
  if (users.find(u => u.email === email.toLowerCase())) {
    throw new Error('Email already registered');
  }

  // Create org
  const orgs = readTable('orgs');
  const org = {
    id: randomUUID(),
    name: orgName || `${name}'s Org`,
    plan: 'free',
    stripe_customer_id: null,
    created_at: new Date().toISOString(),
  };
  orgs.push(org);
  writeTable('orgs', orgs);

  const user = {
    id: randomUUID(),
    email: email.toLowerCase(),
    password_hash: hashPassword(password),
    name,
    org_id: org.id,
    plan: 'free',
    role: 'user',
    created_at: new Date().toISOString(),
    last_login: null,
  };
  users.push(user);
  writeTable('users', users);

  // Org membership
  const members = readTable('org_members');
  members.push({ org_id: org.id, user_id: user.id, role: 'owner' });
  writeTable('org_members', members);

  // Starting credits
  const credits = readTable('credits');
  credits.push({ user_id: user.id, balance: 100, updated_at: new Date().toISOString() });
  writeTable('credits', credits);

  const { password_hash: _, ...safeUser } = user;
  return { ...safeUser, org };
}

export function getUserByEmail(email) {
  const users = readTable('users');
  return users.find(u => u.email === email.toLowerCase()) || null;
}

export function getUserById(id) {
  const users = readTable('users');
  return users.find(u => u.id === id) || null;
}

export function updateLastLogin(userId) {
  const users = readTable('users');
  const idx = users.findIndex(u => u.id === userId);
  if (idx >= 0) {
    users[idx].last_login = new Date().toISOString();
    writeTable('users', users);
  }
}

export function listUsers(orgId) {
  const users = readTable('users');
  const filtered = orgId ? users.filter(u => u.org_id === orgId) : users;
  return filtered.map(({ password_hash: _, ...u }) => u);
}

export function updateUserPlan(userId, plan) {
  const users = readTable('users');
  const idx = users.findIndex(u => u.id === userId);
  if (idx < 0) throw new Error('User not found');
  users[idx].plan = plan;
  writeTable('users', users);
  const { password_hash: _, ...u } = users[idx];
  return u;
}

export function setUserRole(userId, role) {
  const users = readTable('users');
  const idx = users.findIndex(u => u.id === userId);
  if (idx < 0) throw new Error('User not found');
  users[idx].role = role;
  writeTable('users', users);
}

export function banUser(userId) {
  const users = readTable('users');
  const idx = users.findIndex(u => u.id === userId);
  if (idx < 0) throw new Error('User not found');
  users[idx].banned = true;
  writeTable('users', users);
}
