/**
 * File Sandbox Manager — manage file access restrictions and boundaries.
 */

import { resolve, normalize } from "node:path";

/**
 * @param {{ root: string }} opts
 */
export function createFileSandbox({ root }) {
  const normalizedRoot = normalize(root);
  const denyRules = [];
  let totalChecks = 0;
  let blocked = 0;

  function addRule({ type, pattern }) {
    if (type === "deny") {
      denyRules.push(pattern);
    }
  }

  function isAllowed(filePath) {
    totalChecks++;

    // Resolve to absolute and normalize
    const resolved = normalize(resolve(root, filePath.startsWith("/") ? filePath : filePath));

    // Check if within root (prevent traversal)
    if (!resolved.startsWith(normalizedRoot)) {
      blocked++;
      return false;
    }

    // Check deny rules
    for (const pattern of denyRules) {
      if (matchGlob(pattern, resolved)) {
        blocked++;
        return false;
      }
    }

    return true;
  }

  function matchGlob(pattern, path) {
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(1); // e.g., ".env"
      return path.endsWith(ext);
    }
    return path.includes(pattern);
  }

  function getStats() {
    return { totalChecks, blocked, allowed: totalChecks - blocked };
  }

  return { isAllowed, addRule, getStats };
}
