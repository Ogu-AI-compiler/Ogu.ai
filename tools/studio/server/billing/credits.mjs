/**
 * AoaS Credits System
 * Users start with 100 credits; LLM spend deducts credits.
 */
import { readTable, writeTable, randomUUID } from '../auth/db.mjs';

/**
 * Get credit balance for a user.
 */
export function getBalance(userId) {
  const credits = readTable('credits');
  const entry = credits.find(c => c.user_id === userId);
  return entry ? entry.balance : 0;
}

/**
 * Deduct credits from a user.
 * Returns { success, remaining }
 */
export function deductCredits(userId, amount, reason = '') {
  if (amount <= 0) throw new Error('Amount must be positive');
  const credits = readTable('credits');
  const idx = credits.findIndex(c => c.user_id === userId);
  if (idx < 0) return { success: false, remaining: 0 };
  if (credits[idx].balance < amount) return { success: false, remaining: credits[idx].balance };
  credits[idx].balance -= amount;
  credits[idx].updated_at = new Date().toISOString();
  writeTable('credits', credits);
  _logTransaction(userId, -amount, reason);
  return { success: true, remaining: credits[idx].balance };
}

/**
 * Add credits to a user.
 * Returns new balance.
 */
export function addCredits(userId, amount, reason = '') {
  if (amount <= 0) throw new Error('Amount must be positive');
  const credits = readTable('credits');
  const idx = credits.findIndex(c => c.user_id === userId);
  if (idx < 0) {
    credits.push({ user_id: userId, balance: amount, updated_at: new Date().toISOString() });
    writeTable('credits', credits);
    _logTransaction(userId, amount, reason);
    return amount;
  }
  credits[idx].balance += amount;
  credits[idx].updated_at = new Date().toISOString();
  writeTable('credits', credits);
  _logTransaction(userId, amount, reason);
  return credits[idx].balance;
}

function _logTransaction(userId, delta, reason) {
  try {
    const txDir = readTable('credit_transactions') || [];
    txDir.push({ id: randomUUID(), user_id: userId, delta, reason, ts: new Date().toISOString() });
    writeTable('credit_transactions', txDir);
  } catch {}
}

/**
 * Get transaction history for a user.
 */
export function getTransactions(userId, limit = 20) {
  const txs = readTable('credit_transactions');
  return txs.filter(t => t.user_id === userId).slice(-limit).reverse();
}
