import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Crypto Attestation — SHA-256 signing and verification for artifacts/envelopes.
 *
 * Provides tamper-detection for the pipeline:
 *   - Every artifact gets a hash attestation
 *   - Attestations chain together (each references previous hash)
 *   - Verification detects content tampering
 *
 * Storage: .ogu/attestations/{featureSlug}/{taskId}.attestation.json
 */

const ATTESTATIONS_DIR = () => join(repoRoot(), '.ogu/attestations');

/**
 * Compute SHA-256 hash of content string.
 */
export function hashContent(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Create a signed attestation for content.
 *
 * @param {object} options
 * @param {string} options.type — Attestation type (artifact, input, output, gate)
 * @param {string} options.taskId
 * @param {string} options.featureSlug
 * @param {string} options.content — Content to attest
 * @param {string} [options.previousHash] — Hash of previous attestation in chain
 * @returns {object} Attestation record
 */
export function createAttestation({ type, taskId, featureSlug, content, previousHash }) {
  const contentHash = hashContent(content);

  // Signature = hash of (contentHash + type + taskId + previousHash)
  const signatureInput = `${contentHash}:${type}:${taskId}:${previousHash || 'root'}`;
  const signature = hashContent(signatureInput);

  const attestation = {
    type,
    taskId,
    featureSlug,
    hash: contentHash,
    signature,
    previousHash: previousHash || null,
    timestamp: new Date().toISOString(),
    algorithm: 'sha256',
  };

  return attestation;
}

/**
 * Verify an attestation against content.
 *
 * @param {object} attestation — Attestation record
 * @param {string} content — Content to verify
 * @returns {{ valid: boolean, reason?: string }}
 */
export function verifyAttestation(attestation, content) {
  const contentHash = hashContent(content);

  if (contentHash !== attestation.hash) {
    return {
      valid: false,
      reason: `Content hash mismatch: expected ${attestation.hash}, got ${contentHash}`,
    };
  }

  // Verify signature
  const signatureInput = `${contentHash}:${attestation.type}:${attestation.taskId}:${attestation.previousHash || 'root'}`;
  const expectedSig = hashContent(signatureInput);

  if (expectedSig !== attestation.signature) {
    return {
      valid: false,
      reason: `Signature mismatch: attestation metadata may have been tampered`,
    };
  }

  return { valid: true };
}

/**
 * Build and validate an attestation chain.
 *
 * @param {Array<object>} attestations — Ordered list of attestations
 * @returns {{ valid: boolean, length: number, links: Array<object>, error?: string }}
 */
export function buildChain(attestations) {
  if (attestations.length === 0) {
    return { valid: true, length: 0, links: [] };
  }

  const links = [];

  for (let i = 0; i < attestations.length; i++) {
    const att = attestations[i];

    if (i > 0) {
      const prev = attestations[i - 1];
      if (att.previousHash && att.previousHash !== prev.hash) {
        return {
          valid: false,
          length: attestations.length,
          links,
          error: `Chain break at index ${i}: expected previousHash ${prev.hash}, got ${att.previousHash}`,
        };
      }
    }

    links.push(att);
  }

  return { valid: true, length: links.length, links };
}

/**
 * Store attestation to disk.
 */
export function storeAttestation(attestation) {
  const dir = join(ATTESTATIONS_DIR(), attestation.featureSlug);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${attestation.taskId}.attestation.json`);
  writeFileSync(filePath, JSON.stringify(attestation, null, 2), 'utf8');
  return filePath;
}

/**
 * Load attestation from disk.
 */
export function loadAttestation(taskId, featureSlug) {
  const filePath = join(ATTESTATIONS_DIR(), featureSlug, `${taskId}.attestation.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8'));
}
