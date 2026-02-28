import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';
import {
  createAttestation, verifyAttestation, storeAttestation, loadAttestation,
} from './lib/crypto-attestation.mjs';
import { loadArtifacts } from './lib/artifact-store.mjs';

/**
 * ogu attest:create --feature <slug> --task <taskId>
 * ogu attest:verify --feature <slug> --task <taskId>
 */

function parseArgs() {
  const args = process.argv.slice(3);
  const result = { feature: null, task: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--feature' && args[i + 1]) result.feature = args[++i];
    else if (args[i] === '--task' && args[i + 1]) result.task = args[++i];
  }
  return result;
}

export async function attestCreate() {
  const args = parseArgs();
  if (!args.feature || !args.task) {
    console.error('Usage: ogu attest:create --feature <slug> --task <taskId>');
    return 1;
  }

  // Load artifact content
  const artifact = loadArtifacts(args.task, args.feature);
  if (!artifact) {
    console.error(`No artifact found for task "${args.task}" in feature "${args.feature}"`);
    return 1;
  }

  const content = JSON.stringify(artifact);
  const att = createAttestation({
    type: 'artifact',
    taskId: args.task,
    featureSlug: args.feature,
    content,
  });

  const path = storeAttestation(att);
  console.log(`Attestation created for ${args.task}:`);
  console.log(`  Hash: ${att.hash}`);
  console.log(`  Signature: ${att.signature}`);
  console.log(`  Stored: ${path.replace(repoRoot() + '/', '')}`);
  return 0;
}

export async function attestVerify() {
  const args = parseArgs();
  if (!args.feature || !args.task) {
    console.error('Usage: ogu attest:verify --feature <slug> --task <taskId>');
    return 1;
  }

  const att = loadAttestation(args.task, args.feature);
  if (!att) {
    console.error(`No attestation found for task "${args.task}" in feature "${args.feature}"`);
    return 1;
  }

  const artifact = loadArtifacts(args.task, args.feature);
  if (!artifact) {
    console.error(`No artifact found for task "${args.task}" — cannot verify`);
    return 1;
  }

  const content = JSON.stringify(artifact);
  const result = verifyAttestation(att, content);

  if (result.valid) {
    console.log(`✓ VALID — attestation verified for ${args.task}`);
    console.log(`  Hash: ${att.hash}`);
  } else {
    console.log(`✗ INVALID — ${result.reason}`);
    return 1;
  }

  return 0;
}
