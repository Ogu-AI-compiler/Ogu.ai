import { captureSnapshot, listSnapshots, loadSnapshot } from './lib/execution-snapshot.mjs';
import { diffSnapshots } from './lib/snapshot-diff.mjs';
import { createSnapshotStore } from './lib/snapshot-store.mjs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';

// Snapshot store for persisting snapshots (Phase 3D)
const _getStore = () => createSnapshotStore({ dir: join(repoRoot(), '.ogu/snapshots') });

/**
 * ogu snapshot:create [--label <label>]
 */
export async function snapshotCreate() {
  const args = process.argv.slice(3);
  const labelIdx = args.indexOf('--label');
  const label = labelIdx >= 0 ? args[labelIdx + 1] : undefined;

  const snap = captureSnapshot({ label });
  // captureSnapshot already persists to .ogu/snapshots/ — store is used for external snapshots only

  console.log(`Snapshot created: ${snap.id}`);
  console.log(`  Label: ${snap.label || '(none)'}`);
  console.log(`  Hash:  ${snap.hash.slice(0, 16)}`);
  return 0;
}

/**
 * ogu snapshot:diff <id1> <id2>
 */
export async function snapshotDiff() {
  const id1 = process.argv[3];
  const id2 = process.argv[4];
  if (!id1 || !id2) {
    console.error('Usage: ogu snapshot:diff <id1> <id2>');
    return 1;
  }

  const store = _getStore();
  const snap1 = await store.load(id1).catch(() => null) || loadSnapshot({ snapshotId: id1 });
  const snap2 = await store.load(id2).catch(() => null) || loadSnapshot({ snapshotId: id2 });

  if (!snap1) { console.error(`Snapshot not found: ${id1}`); return 1; }
  if (!snap2) { console.error(`Snapshot not found: ${id2}`); return 1; }

  const result = diffSnapshots(snap1, snap2);
  console.log(`\n  Snapshot diff: ${id1.slice(0, 8)} → ${id2.slice(0, 8)}`);
  console.log(`  Drifted: ${result.drifted}`);
  console.log(`  Changes: ${result.changes.length}`);
  for (const change of result.changes) {
    console.log(`    [${change.type}] ${change.key}`);
  }
  return result.drifted ? 1 : 0;
}

/**
 * ogu snapshot:list [--json]
 */
export async function snapshotList() {
  const args = process.argv.slice(3);
  const jsonOutput = args.includes('--json');

  const snaps = listSnapshots();

  if (jsonOutput) {
    console.log(JSON.stringify(snaps, null, 2));
    return 0;
  }

  if (snaps.length === 0) {
    console.log('No snapshots found.');
    return 0;
  }

  console.log(`\n  Snapshots (${snaps.length}):\n`);
  for (const s of snaps) {
    const label = s.label ? ` [${s.label}]` : '';
    console.log(`  ${s.id.slice(0, 8)}  ${s.timestamp.slice(0, 19)}${label}  ${s.hash.slice(0, 12)}`);
  }
  console.log('');
  return 0;
}

/**
 * ogu snapshot:show <id>
 */
export async function snapshotShow() {
  const id = process.argv[3];
  if (!id) {
    console.error('Usage: ogu snapshot:show <snapshot-id>');
    return 1;
  }

  const snap = loadSnapshot({ snapshotId: id });
  if (!snap) {
    console.error(`Snapshot not found: ${id}`);
    return 1;
  }

  console.log(JSON.stringify(snap, null, 2));
  return 0;
}
