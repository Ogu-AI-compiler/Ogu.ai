/**
 * Failure Domain & Circuit Breaker CLI Commands.
 *
 * Commands:
 *   system:halt     — Emergency system halt
 *   system:resume   — Resume after halt (requires actor)
 *   system:health   — Show all failure domains + circuit breakers
 *   circuit:status  — Circuit breaker status per domain
 *   circuit:reset   — Manually close a circuit breaker
 *   provider:health — Provider health dashboard
 *   provider:failover — Test failover chain (dry-run)
 */

import { repoRoot } from '../util.mjs';
import { halt, resume, getSystemHealth, getHaltLog } from './lib/system-halt.mjs';
import { getAllBreakerStatus, resetBreaker, getProviderHealth, testFailover, FAILURE_DOMAINS } from './lib/circuit-breaker.mjs';

export async function systemHalt() {
  const root = repoRoot();
  const reason = process.argv.find((a, i) => process.argv[i - 1] === '--reason') || 'Manual halt via CLI';
  const actor = process.argv.find((a, i) => process.argv[i - 1] === '--actor') || 'cli-user';

  const result = halt(root, { reason, actor });

  if (!result.halted) {
    console.log(`System halt skipped: ${result.reason}`);
    return 1;
  }

  console.log('SYSTEM HALTED');
  console.log(`  Reason:     ${reason}`);
  console.log(`  Actor:      ${actor}`);
  console.log(`  Checkpoints: ${result.checkpoints} tasks checkpointed`);
  console.log(`  Resources:   ${result.resourcesReleased} slots released`);
  console.log('');
  console.log('To resume: ogu system:resume --actor <name>');
  return 0;
}

export async function systemResume() {
  const root = repoRoot();
  const actor = process.argv.find((a, i) => process.argv[i - 1] === '--actor');
  const approval = process.argv.find((a, i) => process.argv[i - 1] === '--approval');

  if (!actor) {
    console.error('Usage: ogu system:resume --actor <name> [--approval <record>]');
    return 1;
  }

  const result = resume(root, { actor, approvalRecord: approval });

  if (!result.resumed) {
    console.log(`Resume failed: ${result.reason}`);
    if (result.consistencyResult) {
      console.log('Consistency failures:');
      for (const f of result.consistencyResult.failures) {
        console.log(`  - ${f}`);
      }
    }
    return 1;
  }

  console.log('SYSTEM RESUMED');
  console.log(`  Actor: ${actor}`);
  console.log(`  Consistency check: PASSED`);
  return 0;
}

export async function systemHealth() {
  const root = repoRoot();
  const health = getSystemHealth(root);

  const statusIcon = {
    HEALTHY: 'OK',
    DEGRADED: 'DEGRADED',
    FROZEN: 'FROZEN',
    HALTED: 'HALTED',
  };

  console.log(`SYSTEM HEALTH: ${statusIcon[health.overallHealth] || health.overallHealth}`);
  console.log('');

  if (health.halted && health.haltRecord) {
    console.log(`  HALTED since ${health.haltRecord.haltedAt}`);
    console.log(`  Reason: ${health.haltRecord.reason}`);
    console.log(`  Actor:  ${health.haltRecord.actor}`);
    console.log('');
  }

  if (health.activeDegradedModes.length > 0) {
    console.log('  ACTIVE DEGRADED MODES:');
    for (const m of health.activeDegradedModes) {
      console.log(`    ${m.domain} → ${m.mode}`);
    }
    console.log('');
  }

  console.log('  FAILURE DOMAINS:');
  console.log('  DOMAIN           BREAKER     HALT   FAILOVER');
  console.log('  ──────────────── ─────────── ────── ─────────────────────────────');

  for (const d of health.domains) {
    const state = d.hasBreaker ? d.breakerState.toUpperCase().padEnd(11) : 'none'.padEnd(11);
    const haltFlag = d.haltOnFailure ? 'yes' : 'no';
    console.log(`  ${d.domainId.padEnd(18)} ${state} ${haltFlag.padEnd(6)} ${d.failoverStrategy}`);
  }

  return 0;
}

export async function circuitStatus() {
  const root = repoRoot();
  const breakers = getAllBreakerStatus(root);

  console.log('CIRCUIT BREAKER STATUS:');
  console.log('');
  console.log('  DOMAIN           STATE       TRIPS  FAIL   SUCCESS  LAST FAILURE');
  console.log('  ──────────────── ─────────── ────── ────── ──────── ────────────────────');

  for (const b of breakers) {
    if (!b.hasBreaker) {
      console.log(`  ${b.domainId.padEnd(18)} ${'N/A (halt)'.padEnd(11)} —      —      —        —`);
      continue;
    }

    const state = b.breakerState.toUpperCase().padEnd(11);
    const trips = String(b.totalTrips).padEnd(6);
    const fails = String(b.totalFailures).padEnd(6);
    const succ = String(b.totalSuccesses).padEnd(8);
    const lastFail = b.lastFailure ? b.lastFailure.slice(0, 19) : '—';
    console.log(`  ${b.domainId.padEnd(18)} ${state} ${trips} ${fails} ${succ} ${lastFail}`);
  }

  console.log('');
  console.log('  Failure modes per domain:');
  for (const b of breakers) {
    console.log(`    ${b.domainId}: ${b.failureModes.join(', ')}`);
  }

  return 0;
}

export async function circuitReset() {
  const root = repoRoot();
  const domainId = process.argv[3];

  if (!domainId) {
    console.error('Usage: ogu circuit:reset <domainId>');
    console.error(`Available domains: ${Object.keys(FAILURE_DOMAINS).join(', ')}`);
    return 1;
  }

  if (!FAILURE_DOMAINS[domainId]) {
    console.error(`Unknown domain: ${domainId}`);
    console.error(`Available: ${Object.keys(FAILURE_DOMAINS).join(', ')}`);
    return 1;
  }

  const result = resetBreaker(root, domainId);
  console.log(`Circuit breaker reset: ${domainId}`);
  console.log(`  Previous state: ${result.previousState}`);
  console.log(`  New state: ${result.newState}`);
  return 0;
}

export async function providerHealth() {
  const root = repoRoot();
  const health = getProviderHealth(root);

  console.log('PROVIDER HEALTH:');
  console.log(`  Domain: ${health.domain}`);
  console.log(`  Circuit: ${health.breakerState.toUpperCase()}`);
  console.log(`  Failover chain: ${health.failoverChain.join(' → ')}`);
  console.log('');

  console.log('  PROVIDER     STATUS      MODELS');
  console.log('  ──────────── ─────────── ──────────────────────');
  for (const p of health.providers) {
    const models = p.models.length > 0 ? p.models.join(', ') : '—';
    console.log(`  ${p.name.padEnd(12)} ${p.status.padEnd(11)} ${models}`);
  }

  console.log('');
  console.log(`  Circuit config: threshold=${health.circuit.threshold}, window=${health.circuit.windowMs}ms, cooldown=${health.circuit.cooldownMs}ms`);
  console.log(`  Total failures: ${health.circuit.recentFailures}, Total trips: ${health.circuit.totalTrips}`);
  return 0;
}

export async function providerFailover() {
  const root = repoRoot();
  const isDryRun = process.argv.includes('--test') || process.argv.includes('--dry-run');
  const domainId = process.argv.find((a, i) => process.argv[i - 1] === '--domain') || 'FD-PROVIDER';

  const result = testFailover(root, domainId);

  if (!result.dryRun && !isDryRun) {
    console.error('Failover test requires --test flag');
    return 1;
  }

  console.log(`FAILOVER TEST (dry-run) — ${result.domainId}`);
  console.log(`  Strategy: ${result.strategy}`);
  console.log('');

  for (const r of result.results) {
    const failoverTag = r.wouldFailover ? ' (failover)' : ' (primary)';
    const latency = r.latencyMs ? `${r.latencyMs}ms` : '—';
    console.log(`  ${r.position}. ${r.provider || r.strategy} — ${r.status} — ${latency}${failoverTag}`);
  }

  return 0;
}
