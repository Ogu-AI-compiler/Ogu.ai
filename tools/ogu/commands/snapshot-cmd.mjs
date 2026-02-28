import { captureSnapshot, listSnapshots, loadSnapshot } from './lib/execution-snapshot.mjs';

/**
 * ogu snapshot:create [--label <label>]
 */
export async function snapshotCreate() {
  const args = process.argv.slice(3);
  const labelIdx = args.indexOf('--label');
  const label = labelIdx >= 0 ? args[labelIdx + 1] : undefined;

  const snap = captureSnapshot({ label });
  console.log(`Snapshot created: ${snap.id}`);
  console.log(`  Label: ${snap.label || '(none)'}`);
  console.log(`  Hash:  ${snap.hash.slice(0, 16)}`);
  return 0;
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
