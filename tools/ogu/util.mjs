import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

/**
 * Find the project root directory.
 * Priority: OGU_ROOT env var → walk up from cwd to find .git
 * OGU_ROOT is set by Ogu Studio when operating on a user's project.
 */
export function repoRoot() {
  // When running via Studio, OGU_ROOT points to the user's project
  if (process.env.OGU_ROOT) {
    return resolve(process.env.OGU_ROOT);
  }
  // Fallback: walk up from cwd to find a git repo
  let dir = resolve(process.cwd());
  while (dir !== "/") {
    if (existsSync(resolve(dir, ".git"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("Not inside a git repository and OGU_ROOT is not set. Run 'git init' or set OGU_ROOT.");
}

/**
 * Global Ogu directory (~/.ogu/) for cross-project data.
 */
export function globalRoot() {
  return join(homedir(), ".ogu");
}

/**
 * Safely read and parse a JSON file. Returns null if missing or invalid.
 */
export function readJsonSafe(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Deep structural diff between two JSON objects.
 * Returns { added, removed, changed } where each is an array of path descriptions.
 */
export function deepDiff(oldObj, newObj, prefix = "") {
  const result = { added: [], removed: [], changed: [] };

  if (oldObj === null || oldObj === undefined) {
    if (newObj !== null && newObj !== undefined) {
      result.added.push({ path: prefix || "(root)", value: summarize(newObj) });
    }
    return result;
  }
  if (newObj === null || newObj === undefined) {
    result.removed.push({ path: prefix || "(root)", value: summarize(oldObj) });
    return result;
  }

  if (typeof oldObj !== typeof newObj) {
    result.changed.push({ path: prefix || "(root)", from: summarize(oldObj), to: summarize(newObj) });
    return result;
  }

  if (Array.isArray(oldObj) && Array.isArray(newObj)) {
    return diffArrays(oldObj, newObj, prefix, result);
  }

  if (typeof oldObj === "object") {
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    for (const key of allKeys) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (!(key in oldObj)) {
        result.added.push({ path, value: summarize(newObj[key]) });
      } else if (!(key in newObj)) {
        result.removed.push({ path, value: summarize(oldObj[key]) });
      } else {
        const sub = deepDiff(oldObj[key], newObj[key], path);
        result.added.push(...sub.added);
        result.removed.push(...sub.removed);
        result.changed.push(...sub.changed);
      }
    }
    return result;
  }

  // Primitives
  if (oldObj !== newObj) {
    result.changed.push({ path: prefix || "(root)", from: String(oldObj), to: String(newObj) });
  }
  return result;
}

function diffArrays(oldArr, newArr, prefix, result) {
  const maxLen = Math.max(oldArr.length, newArr.length);
  for (let i = 0; i < maxLen; i++) {
    const path = `${prefix}[${i}]`;
    if (i >= oldArr.length) {
      result.added.push({ path, value: summarize(newArr[i]) });
    } else if (i >= newArr.length) {
      result.removed.push({ path, value: summarize(oldArr[i]) });
    } else {
      const sub = deepDiff(oldArr[i], newArr[i], path);
      result.added.push(...sub.added);
      result.removed.push(...sub.removed);
      result.changed.push(...sub.changed);
    }
  }
  return result;
}

function summarize(val) {
  if (val === null || val === undefined) return String(val);
  if (typeof val === "string") return val.length > 60 ? val.slice(0, 60) + "..." : val;
  if (typeof val !== "object") return String(val);
  if (Array.isArray(val)) return `[array of ${val.length}]`;
  const keys = Object.keys(val);
  return `{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", ..." : ""}}`;
}
