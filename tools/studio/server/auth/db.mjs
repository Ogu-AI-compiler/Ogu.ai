/**
 * AoaS Auth DB — file-based data store
 * Uses JSON files in AOAS_DATA_DIR (default: ~/.ogu/aoas/)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

export function getDataDir() {
  return process.env.AOAS_DATA_DIR || join(homedir(), '.ogu', 'aoas');
}

function ensureDir() {
  mkdirSync(getDataDir(), { recursive: true });
}

export function readTable(table) {
  ensureDir();
  try {
    return JSON.parse(readFileSync(join(getDataDir(), `${table}.json`), 'utf-8'));
  } catch {
    return [];
  }
}

export function writeTable(table, data) {
  ensureDir();
  writeFileSync(join(getDataDir(), `${table}.json`), JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export { randomUUID };

/**
 * Initialise all tables (idempotent).
 * Tables: users, orgs, org_members, sessions, usage_events, credits, api_keys, invites
 */
export function initDb() {
  ensureDir();
  const tables = ['users', 'orgs', 'org_members', 'sessions', 'usage_events', 'credits', 'api_keys', 'invites'];
  for (const t of tables) {
    try {
      readFileSync(join(getDataDir(), `${t}.json`), 'utf-8');
    } catch {
      writeTable(t, []);
    }
  }
}
