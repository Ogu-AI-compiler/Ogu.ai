/**
 * Deterministic Mode + Company Freeze CLI Commands.
 *
 * deterministic:enable   — Enter deterministic mode (full lockdown)
 * deterministic:disable  — Exit deterministic mode
 * deterministic:status   — Show current mode + locks
 * freeze                 — Freeze organization (read-only)
 * thaw                   — Unfreeze organization
 */

import { enableDeterministic, disableDeterministic, getDeterministicStatus } from './lib/deterministic-mode.mjs';
import { freeze, thaw, getFreezeStatus } from './lib/company-freeze.mjs';

export async function deterministicEnable() {
  const args = process.argv.slice(3);
  const seedIdx = args.indexOf('--seed');
  const seed = seedIdx >= 0 ? parseInt(args[seedIdx + 1], 10) : undefined;
  const actorIdx = args.indexOf('--actor');
  const actor = actorIdx >= 0 ? args[actorIdx + 1] : 'cli-user';

  const result = enableDeterministic({ seed, actor });

  if (!result.enabled) {
    console.log(`Deterministic mode: ${result.reason}`);
    return 1;
  }

  console.log('DETERMINISTIC MODE ACTIVATED');
  console.log('');
  console.log('  LOCKED:');
  for (const [key, value] of Object.entries(result.locks || {})) {
    console.log(`    ${key}: ${value}`);
  }
  console.log('');
  console.log('  DISABLED:');
  for (const [key, value] of Object.entries(result.behavior || {})) {
    console.log(`    ${key}: ${value}`);
  }
  console.log('');
  console.log(`  Entry snapshot: ${result.entrySnapshot}`);
  console.log('  Exit: ogu deterministic:disable');
  return 0;
}

export async function deterministicDisable() {
  const actorIdx = process.argv.indexOf('--actor');
  const actor = actorIdx >= 0 ? process.argv[actorIdx + 1] : 'cli-user';

  const result = disableDeterministic({ actor });

  if (!result.disabled) {
    console.log(`Deterministic mode: ${result.reason}`);
    return 1;
  }

  console.log('DETERMINISTIC MODE DEACTIVATED');
  console.log(`  Entry snapshot: ${result.entrySnapshot}`);
  console.log(`  Exit snapshot: ${result.exitSnapshot}`);
  return 0;
}

export async function deterministicStatus() {
  const status = getDeterministicStatus();

  if (!status.active) {
    console.log('Deterministic mode: OFF');
    if (status.disabledAt) console.log(`  Last disabled: ${status.disabledAt}`);
    return 0;
  }

  console.log('Deterministic mode: ON');
  console.log(`  Enabled at: ${status.enabledAt}`);
  console.log(`  Activated by: ${status.activatedBy}`);
  if (status.seed !== null) console.log(`  Seed: ${status.seed}`);
  console.log('');
  console.log('  LOCKS:');
  for (const [key, value] of Object.entries(status.locks || {})) {
    console.log(`    ${key}: ${value}`);
  }
  console.log('');
  console.log('  BEHAVIOR:');
  for (const [key, value] of Object.entries(status.behavior || {})) {
    console.log(`    ${key}: ${value}`);
  }
  if (status.entrySnapshot) {
    console.log('');
    console.log(`  Entry snapshot: ${status.entrySnapshot}`);
  }
  return 0;
}

export async function freezeCmd() {
  const args = process.argv.slice(3);

  // Check --status flag
  if (args.includes('--status')) {
    const status = getFreezeStatus();
    if (!status.frozen) {
      console.log('Organization: NOT FROZEN');
      if (status.lastThawedAt) console.log(`  Last thawed: ${status.lastThawedAt}`);
    } else {
      console.log('Organization: FROZEN');
      console.log(`  Since: ${status.frozenAt}`);
      console.log(`  By: ${status.frozenBy}`);
      console.log(`  Reason: ${status.reason}`);
    }
    return 0;
  }

  const reasonIdx = args.indexOf('--reason');
  const reason = reasonIdx >= 0 ? args[reasonIdx + 1] : undefined;
  const actorIdx = args.indexOf('--actor');
  const actor = actorIdx >= 0 ? args[actorIdx + 1] : 'cli-user';

  const result = freeze({ reason, actor });

  if (!result.frozen) {
    console.log(`Freeze skipped: ${result.reason}`);
    return 1;
  }

  console.log('COMPANY FROZEN');
  console.log(`  Reason: ${result.reason}`);
  console.log(`  Checkpoints: ${result.checkpoints} tasks checkpointed`);
  console.log(`  Snapshot: ${result.snapshotId}`);
  console.log('');
  console.log('  ALLOWED: read, metrics, audit, status');
  console.log('  BLOCKED: writes, scheduling, execution, changes');
  console.log('');
  console.log('  Unfreeze: ogu thaw --actor <name>');
  return 0;
}

export async function thawCmd() {
  const actorIdx = process.argv.indexOf('--actor');
  const actor = actorIdx >= 0 ? process.argv[actorIdx + 1] : undefined;

  if (!actor) {
    console.error('Usage: ogu thaw --actor <name>');
    return 1;
  }

  const result = thaw({ actor });

  if (!result.thawed) {
    console.log(`Thaw failed: ${result.reason}`);
    if (result.consistencyResult) {
      for (const f of result.consistencyResult.failures) {
        console.log(`  - ${f}`);
      }
    }
    return 1;
  }

  console.log('COMPANY UNFROZEN');
  console.log(`  Consistency check: PASSED`);
  console.log(`  Entry snapshot: ${result.entrySnapshot}`);
  console.log(`  Exit snapshot: ${result.exitSnapshot}`);
  return 0;
}
