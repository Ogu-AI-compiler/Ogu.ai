/**
 * Secret Vault Tests.
 *
 * 8 tests covering:
 *   Section 1: issueSecret + retrieveSecret (3 tests)
 *   Section 2: revokeSecret (2 tests)
 *   Section 3: listSecrets + buildSecureEnv (3 tests)
 */

import { issueSecret, retrieveSecret, revokeSecret, listSecrets, buildSecureEnv } from '../commands/lib/secret-vault.mjs';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, name) {
  if (condition) {
    passed++;
    results.push(`  PASS  ${passed + failed}. ${name}`);
  } else {
    failed++;
    results.push(`  FAIL  ${passed + failed}. ${name}`);
  }
}

function makeTmpRoot() {
  const root = join(tmpdir(), `ogu-vault-test-${randomUUID().slice(0, 8)}`);
  mkdirSync(join(root, '.ogu/secrets'), { recursive: true });
  mkdirSync(join(root, '.ogu/audit'), { recursive: true });
  return root;
}

// ═══════════════════════════════════════════════════════════════════════
// Section 1: issueSecret + retrieveSecret
// ═══════════════════════════════════════════════════════════════════════

// 1. issueSecret stores encrypted value
{
  const root = makeTmpRoot();
  const result = issueSecret(root, { key: 'api-key', value: 'sk-12345', grantedTo: ['admin'] });
  assert(result && result.key === 'api-key' && result.path,
    'issueSecret stores encrypted value');
  rmSync(root, { recursive: true, force: true });
}

// 2. retrieveSecret decrypts correctly (roundtrip)
{
  const root = makeTmpRoot();
  issueSecret(root, { key: 'api-key', value: 'sk-12345', grantedTo: ['admin'] });
  const value = retrieveSecret(root, 'api-key', 'admin');
  assert(value === 'sk-12345', 'retrieveSecret decrypts correctly (roundtrip)');
  rmSync(root, { recursive: true, force: true });
}

// 3. retrieveSecret returns null for non-existent secret
{
  const root = makeTmpRoot();
  const value = retrieveSecret(root, 'non-existent', 'admin');
  assert(value === null, 'retrieveSecret returns null for non-existent secret');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: revokeSecret
// ═══════════════════════════════════════════════════════════════════════

// 4. revokeSecret marks as revoked (deletes file)
{
  const root = makeTmpRoot();
  issueSecret(root, { key: 'api-key', value: 'sk-12345' });
  const revoked = revokeSecret(root, 'api-key', 'admin');
  assert(revoked === true, 'revokeSecret returns true for existing secret');
  rmSync(root, { recursive: true, force: true });
}

// 5. retrieveSecret fails after revoke
{
  const root = makeTmpRoot();
  issueSecret(root, { key: 'api-key', value: 'sk-12345' });
  revokeSecret(root, 'api-key', 'admin');
  const value = retrieveSecret(root, 'api-key', 'admin');
  assert(value === null, 'retrieveSecret returns null after revoke');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: listSecrets + buildSecureEnv
// ═══════════════════════════════════════════════════════════════════════

// 6. listSecrets shows all secrets with metadata
{
  const root = makeTmpRoot();
  issueSecret(root, { key: 'key-1', value: 'v1', grantedTo: ['admin'] });
  issueSecret(root, { key: 'key-2', value: 'v2', grantedTo: ['admin'] });
  const list = listSecrets(root, 'admin');
  assert(Array.isArray(list) && list.length === 2,
    'listSecrets shows all secrets with metadata');
  rmSync(root, { recursive: true, force: true });
}

// 7. listSecrets filters by grantedTo
{
  const root = makeTmpRoot();
  issueSecret(root, { key: 'key-1', value: 'v1', grantedTo: ['admin'] });
  issueSecret(root, { key: 'key-2', value: 'v2', grantedTo: ['dev'] });
  const list = listSecrets(root, 'admin');
  assert(list.length === 1 && list[0].key === 'key-1',
    'listSecrets filters by grantedTo');
  rmSync(root, { recursive: true, force: true });
}

// 8. buildSecureEnv builds env object
{
  const root = makeTmpRoot();
  issueSecret(root, { key: 'db-pass', value: 'secret123', grantedTo: ['backend-dev'] });
  const env = buildSecureEnv(root, 'backend-dev');
  assert(env && env.OGU_SECRET_DB_PASS === 'secret123',
    'buildSecureEnv builds env object with decrypted secrets');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════

console.log('\nSecret Vault Tests');
console.log('═'.repeat(50));
for (const r of results) console.log(r);
console.log('═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
