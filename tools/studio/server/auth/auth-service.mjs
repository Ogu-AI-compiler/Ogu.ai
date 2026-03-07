/**
 * AoaS Auth Service — business logic for register/login/refresh/logout.
 * Used by server/api/auth.ts (HTTP layer) and by tests directly.
 */
import { createUser, getUserByEmail, getUserById, updateLastLogin } from './user-store.mjs';
import { verifyPassword } from './password.mjs';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './jwt.mjs';
import { readTable, writeTable, randomUUID } from './db.mjs';
import { createHmac } from 'crypto';

function hashToken(token) {
  return createHmac('sha256', 'session-hmac').update(token).digest('hex');
}

function createSession(userId, refreshToken) {
  const sessions = readTable('sessions');
  const session = {
    id: randomUUID(),
    user_id: userId,
    token_hash: hashToken(refreshToken),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  };
  sessions.push(session);
  writeTable('sessions', sessions);
  return session;
}

function invalidateSession(tokenHash) {
  const sessions = readTable('sessions');
  writeTable('sessions', sessions.filter(s => s.token_hash !== tokenHash));
}

function isSessionValid(token) {
  const sessions = readTable('sessions');
  const hash = hashToken(token);
  const session = sessions.find(s => s.token_hash === hash);
  if (!session) return false;
  return new Date(session.expires_at) > new Date();
}

function getOrgForUser(userId) {
  const user = getUserById(userId);
  if (!user) return null;
  const orgs = readTable('orgs');
  return orgs.find(o => o.id === user.org_id) || null;
}

/**
 * Register a new user.
 * Returns: { user, accessToken, refreshToken }
 */
export function register({ email, password, name, orgName }) {
  const user = createUser({ email, password, name, orgName });
  const accessToken = signAccessToken({ userId: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id });
  createSession(user.id, refreshToken);
  return { user, accessToken, refreshToken };
}

/**
 * Login with email + password.
 * Returns: { user, accessToken, refreshToken }
 * Throws: 'Invalid credentials' on failure.
 */
export function login({ email, password }) {
  const user = getUserByEmail(email);
  if (!user) throw new Error('Invalid credentials');
  if (user.banned) throw new Error('Account suspended');
  if (!verifyPassword(password, user.password_hash)) throw new Error('Invalid credentials');
  updateLastLogin(user.id);
  // Re-fetch after update so last_login is current
  const updated = getUserById(user.id) || user;
  const { password_hash: _, ...safeUser } = updated;
  const accessToken = signAccessToken({ userId: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id });
  createSession(user.id, refreshToken);
  return { user: safeUser, accessToken, refreshToken };
}

/**
 * Refresh access token using a valid refresh token.
 * Returns: { accessToken }
 * Throws on invalid/expired token.
 */
export function refresh(refreshToken) {
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) throw new Error('Invalid or expired refresh token');
  if (!isSessionValid(refreshToken)) throw new Error('Session not found or expired');
  const user = getUserById(payload.userId);
  if (!user) throw new Error('User not found');
  const accessToken = signAccessToken({ userId: user.id, email: user.email, role: user.role });
  return { accessToken };
}

/**
 * Get current user info + org + subscription.
 */
export function getMe(userId) {
  const user = getUserById(userId);
  if (!user) throw new Error('User not found');
  const { password_hash: _, ...safeUser } = user;
  const org = getOrgForUser(userId);
  return { user: safeUser, org, subscription: { plan: user.plan } };
}

/**
 * Logout — invalidate refresh token session.
 */
export function logout(refreshToken) {
  if (!refreshToken) return;
  invalidateSession(hashToken(refreshToken));
}
