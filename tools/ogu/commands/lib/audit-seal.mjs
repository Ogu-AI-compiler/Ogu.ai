/**
 * Audit Seal — generate and verify cryptographic seals on audit entries.
 */

import { createHmac } from "node:crypto";

/**
 * @param {{ secret: string }} opts
 */
export function createAuditSealer({ secret }) {
  function computeSignature(data) {
    const hmac = createHmac("sha256", secret);
    hmac.update(JSON.stringify(data));
    return hmac.digest("hex");
  }

  function seal(data) {
    const signature = computeSignature(data);
    return {
      data: JSON.parse(JSON.stringify(data)),
      signature,
      sealedAt: Date.now(),
    };
  }

  function verify(sealed) {
    const expected = computeSignature(sealed.data);
    return sealed.signature === expected;
  }

  return { seal, verify };
}
