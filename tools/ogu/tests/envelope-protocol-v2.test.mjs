/**
 * Envelope Protocol v2 Tests.
 *
 * 8 tests covering:
 *   Section 1: createErrorEnvelope + chainEnvelope (3 tests)
 *   Section 2: sealEnvelope + verifySeal (3 tests)
 *   Section 3: validateContext (2 tests)
 */

import {
  createInputEnvelope, createOutputEnvelope, createErrorEnvelope,
  chainEnvelope, sealEnvelope, verifySeal, validateContext,
} from '../commands/lib/envelope-protocol.mjs';

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

// ═══════════════════════════════════════════════════════════════════════
// Section 1: createErrorEnvelope + chainEnvelope
// ═══════════════════════════════════════════════════════════════════════

// 1. createErrorEnvelope has code + message
{
  const env = createErrorEnvelope({
    taskId: 'T1', agentId: 'agent-1',
    error: 'Something went wrong', code: 'OGU5001',
    severity: 'error', recoverable: false,
  });
  assert(env && env.error && (env.code === 'OGU5001' || env.error.code === 'OGU5001' || env.errorCode === 'OGU5001'),
    'createErrorEnvelope has code + message');
}

// 2. chainEnvelope links inReplyTo
{
  const parent = createInputEnvelope({
    taskId: 'T1', agentId: 'agent-1',
    feature: 'test', phase: 'build', context: {},
  });
  const child = chainEnvelope(parent, { taskId: 'T2', agentId: 'agent-2' });
  assert(child && (child.inReplyTo || child.parentId || child.parentEnvelopeId),
    'chainEnvelope links inReplyTo');
}

// 3. createOutputEnvelope has result
{
  const env = createOutputEnvelope({
    taskId: 'T1', agentId: 'agent-1',
    result: { files: ['src/app.ts'] },
    artifacts: [], metrics: { tokensUsed: 100 },
  });
  assert(env && (env.result || env.output),
    'createOutputEnvelope has result');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: sealEnvelope + verifySeal
// ═══════════════════════════════════════════════════════════════════════

// 4. sealEnvelope adds HMAC seal
{
  const env = createInputEnvelope({
    taskId: 'T1', agentId: 'agent-1',
    feature: 'test', phase: 'build', context: {},
  });
  const sealed = sealEnvelope(env);
  assert(sealed && (sealed.seal || sealed.signature || sealed.hash),
    'sealEnvelope adds seal/signature/hash');
}

// 5. verifySeal returns valid=true for sealed envelope
{
  const env = createInputEnvelope({
    taskId: 'T1', agentId: 'agent-1',
    feature: 'test', phase: 'build', context: {},
  });
  const sealed = sealEnvelope(env);
  const verification = verifySeal(sealed);
  assert(verification && verification.valid === true,
    'verifySeal returns valid=true for sealed envelope');
}

// 6. verifySeal returns valid=false for tampered envelope
{
  const env = createInputEnvelope({
    taskId: 'T1', agentId: 'agent-1',
    feature: 'test', phase: 'build', context: {},
  });
  const sealed = sealEnvelope(env);
  // Tamper with the envelope
  sealed.taskId = 'TAMPERED';
  const verification = verifySeal(sealed);
  assert(verification && verification.valid === false,
    'verifySeal returns valid=false for tampered envelope');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: validateContext
// ═══════════════════════════════════════════════════════════════════════

// 7. validateContext passes with matching context
{
  const env = createInputEnvelope({
    taskId: 'T1', agentId: 'agent-1',
    feature: 'auth', phase: 'build', context: { feature: 'auth' },
  });
  const result = validateContext(env, { feature: 'auth' });
  assert(result && result.valid === true,
    'validateContext passes with matching context');
}

// 8. validateContext fails with mismatched context
{
  const env = createInputEnvelope({
    taskId: 'T1', agentId: 'agent-1',
    feature: 'auth', phase: 'build', context: { feature: 'auth' },
  });
  const result = validateContext(env, { feature: 'payments' });
  assert(result && result.valid === false,
    'validateContext fails with mismatched context');
}

// ═══════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════

console.log('\nEnvelope Protocol v2 Tests');
console.log('═'.repeat(50));
for (const r of results) console.log(r);
console.log('═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
