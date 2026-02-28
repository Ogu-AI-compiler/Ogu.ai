/**
 * Execution Graph Hash CLI Commands.
 *
 * graph:hash <slug>               — Compute execution graph hash
 * graph:verify <slug> <hash>      — Verify graph hash matches
 */

import { repoRoot } from '../util.mjs';
import { computeGraphHash, verifyGraphHash, loadGraphHash } from './lib/execution-graph-hash.mjs';

export async function graphHash() {
  const root = repoRoot();
  const slug = process.argv[3];

  if (!slug || slug.startsWith('-')) {
    console.error('Usage: ogu graph:hash <feature-slug>');
    return 1;
  }

  const result = computeGraphHash(root, slug);

  console.log(`EXECUTION GRAPH HASH: ${slug}`);
  console.log('');
  console.log(`  Graph Hash: ${result.graphHash}`);
  console.log(`  Computed:   ${result.computedAt}`);
  console.log('');
  console.log('  COMPONENTS:');
  console.log(`    Plan hash:           ${result.components.planHash.slice(0, 16)}...`);
  console.log(`    Policy version:      ${result.components.policyVersionAtExecution}`);
  console.log(`    Policy AST hash:     ${result.components.policyASTHash.slice(0, 16)}...`);
  console.log(`    OrgSpec version:     ${result.components.orgSpecVersion}`);
  console.log(`    OrgSpec hash:        ${result.components.orgSpecHash.slice(0, 16)}...`);
  console.log(`    Model decisions:     ${result.components.modelRoutingDecisions.length} routing decisions`);
  console.log(`    Decision set hash:   ${result.components.modelDecisionSetHash.slice(0, 16)}...`);
  console.log(`    Task snapshots:      ${Object.keys(result.components.taskSnapshotHashes).length} tasks`);
  console.log(`    Snapshot chain hash: ${result.components.taskSnapshotChainHash.slice(0, 16)}...`);
  console.log('');
  console.log(`  Replay Guarantee: ${result.replayGuarantee}`);
  return 0;
}

export async function graphVerify() {
  const root = repoRoot();
  const slug = process.argv[3];
  const expectedHash = process.argv[4];

  if (!slug || !expectedHash) {
    console.error('Usage: ogu graph:verify <feature-slug> <expected-hash>');
    return 1;
  }

  const result = verifyGraphHash(root, slug, expectedHash);

  if (result.match) {
    console.log(`GRAPH HASH VERIFIED: ${slug}`);
    console.log(`  Hash: ${result.currentHash}`);
    console.log('  Status: MATCH');
  } else {
    console.log(`GRAPH HASH MISMATCH: ${slug}`);
    console.log(`  Expected: ${expectedHash}`);
    console.log(`  Current:  ${result.currentHash}`);
    console.log('  Status: MISMATCH');
  }

  return result.match ? 0 : 1;
}
