/**
 * Data Integrity Verifier — sign and verify data integrity.
 */
import { createHash } from "node:crypto";

export function createIntegrityVerifier() {
  let signed = 0;
  let verified = 0;

  function hash(data) {
    return createHash("sha256").update(data).digest("hex");
  }

  function sign(data) {
    signed++;
    return hash(typeof data === "string" ? data : JSON.stringify(data));
  }

  function verify(data, signature) {
    verified++;
    const expected = hash(typeof data === "string" ? data : JSON.stringify(data));
    return expected === signature;
  }

  function getStats() {
    return { signed, verified };
  }

  return { sign, verify, getStats };
}
