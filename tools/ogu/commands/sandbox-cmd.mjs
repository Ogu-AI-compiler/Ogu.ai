import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';

/**
 * ogu sandbox:policy         — Show sandbox policies for all roles
 * ogu sandbox:check <roleId> <path> — Check if a role can access a path
 */

export async function sandboxPolicy() {
  const root = repoRoot();
  const orgPath = join(root, '.ogu/OrgSpec.json');
  if (!existsSync(orgPath)) {
    console.error('OrgSpec.json not found. Run: ogu org:init');
    return 1;
  }

  const orgSpec = JSON.parse(readFileSync(orgPath, 'utf8'));
  const roles = orgSpec.roles || [];

  console.log(`\n  Sandbox Policies — ${roles.length} roles\n`);
  for (const role of roles) {
    const sandbox = role.sandbox || {};
    console.log(`  ${role.roleId}`);
    console.log(`    Allowed: ${(sandbox.allowedPaths || ['*']).join(', ')}`);
    console.log(`    Blocked: ${(sandbox.blockedPaths || []).join(', ') || 'none'}`);
    console.log(`    Network: ${sandbox.networkAccess || 'none'}`);
    console.log(`    Concurrency: ${sandbox.maxConcurrency || 1}`);
  }
  return 0;
}

export async function sandboxCheck() {
  const args = process.argv.slice(3);
  const roleId = args[0];
  const filePath = args[1];
  if (!roleId || !filePath) {
    console.error('Usage: ogu sandbox:check <roleId> <path>');
    return 1;
  }

  const root = repoRoot();
  const orgPath = join(root, '.ogu/OrgSpec.json');
  if (!existsSync(orgPath)) {
    console.error('OrgSpec.json not found.');
    return 1;
  }

  const orgSpec = JSON.parse(readFileSync(orgPath, 'utf8'));
  const role = (orgSpec.roles || []).find(r => r.roleId === roleId);
  if (!role) {
    console.error(`Role "${roleId}" not found.`);
    return 1;
  }

  const sandbox = role.sandbox || {};
  const blocked = (sandbox.blockedPaths || []);
  const allowed = (sandbox.allowedPaths || ['**']);

  // Check blocked
  for (const pattern of blocked) {
    if (globMatch(pattern, filePath)) {
      console.log(`  BLOCKED — "${filePath}" matches blocked pattern "${pattern}"`);
      return 1;
    }
  }

  // Check allowed
  for (const pattern of allowed) {
    if (globMatch(pattern, filePath)) {
      console.log(`  ALLOWED — "${filePath}" matches allowed pattern "${pattern}"`);
      return 0;
    }
  }

  console.log(`  BLOCKED — "${filePath}" not in allowed paths`);
  return 1;
}

function globMatch(pattern, str) {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`).test(str);
}
