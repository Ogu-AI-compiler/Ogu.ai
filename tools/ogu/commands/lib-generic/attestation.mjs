/**
 * Attestation — cryptographic signing and verification of artifacts.
 */

import { createHash, randomUUID } from 'node:crypto';

export const ATTESTATION_TYPES = ['gate', 'compile', 'deploy', 'audit', 'snapshot'];

function computeSignature(data) {
  return createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
    .slice(0, 32);
}

/**
 * Create an attestation for a result.
 *
 * @param {{ subject: string, result: string, signer: string, metadata?: object }} opts
 * @returns {object} Attestation with id, signature, timestamp
 */
export function createAttestation({ subject, result, signer, metadata = {} }) {
  const id = randomUUID().slice(0, 12);
  const timestamp = new Date().toISOString();
  const signatureData = { subject, result, signer, timestamp, id };
  const signature = computeSignature(signatureData);

  return {
    id,
    subject,
    result,
    signer,
    metadata,
    timestamp,
    signature,
    _signatureData: signatureData,
  };
}

/**
 * Verify an attestation's signature and field integrity.
 *
 * @param {object} attestation
 * @returns {boolean}
 */
export function verifyAttestation(attestation) {
  if (!attestation._signatureData) return false;
  // Check signature matches stored data
  const expected = computeSignature(attestation._signatureData);
  if (attestation.signature !== expected) return false;
  // Check outer fields match signed data
  if (attestation.subject !== attestation._signatureData.subject) return false;
  if (attestation.result !== attestation._signatureData.result) return false;
  if (attestation.signer !== attestation._signatureData.signer) return false;
  return true;
}

/**
 * Build a chain of linked attestations.
 *
 * @param {Array<{ subject: string, result: string, signer: string }>} items
 * @returns {Array<object>}
 */
export function buildChain(items) {
  const chain = [];
  for (const item of items) {
    const att = createAttestation(item);
    if (chain.length > 0) {
      att.previousId = chain[chain.length - 1].id;
    }
    chain.push(att);
  }
  return chain;
}
