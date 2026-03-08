/**
 * Gate: openapi-valid
 * The assembled openapi.json must:
 * - Have openapi: "3.1.0"
 * - Have info with title + version
 * - Have at least one path
 * - Have no dangling internal $refs (checked shallowly)
 */
import { readFileSync, existsSync } from "fs";

function collectRefs(obj, refs = new Set()) {
  if (!obj || typeof obj !== "object") return refs;
  if (Array.isArray(obj)) { obj.forEach(i => collectRefs(i, refs)); return refs; }
  for (const [k, v] of Object.entries(obj)) {
    if (k === "$ref" && typeof v === "string" && v.startsWith("#/")) refs.add(v);
    else collectRefs(v, refs);
  }
  return refs;
}

function resolvePath(obj, path) {
  // path like "#/components/schemas/User" → ["components", "schemas", "User"]
  const parts = path.replace(/^#\//, "").split("/");
  let cur = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

export async function run({ dir }) {
  const docPath = `${dir}/openapi.json`;
  if (!existsSync(docPath)) {
    return { pass: false, code: "OS005", message: "openapi.json not found — assemble phase may not have run" };
  }

  let doc;
  try { doc = JSON.parse(readFileSync(docPath, "utf8")); }
  catch (e) { return { pass: false, code: "OS005", message: `openapi.json parse error: ${e.message}` }; }

  const issues = [];

  if (!doc.openapi || !doc.openapi.startsWith("3.")) issues.push("Missing or invalid openapi version (expected 3.x)");
  if (!doc.info?.title) issues.push("info.title missing");
  if (!doc.info?.version) issues.push("info.version missing");
  if (!doc.paths || Object.keys(doc.paths).length === 0) issues.push("No paths defined");
  if (!Array.isArray(doc.servers) || doc.servers.length === 0) issues.push("No servers defined");

  if (issues.length) {
    return { pass: false, code: "OS005", message: `OpenAPI document invalid: ${issues.join("; ")}`, detail: { issues } };
  }

  // Check for dangling $refs
  const refs = collectRefs(doc);
  const dangling = [];
  for (const ref of refs) {
    if (resolvePath(doc, ref) === undefined) {
      dangling.push(ref);
    }
  }

  if (dangling.length) {
    return {
      pass: false,
      code: "OS007",
      message: `${dangling.length} dangling $ref(s) in assembled document`,
      detail: { dangling },
    };
  }

  return {
    pass: true,
    detail: {
      openapi: doc.openapi,
      title: doc.info.title,
      version: doc.info.version,
      pathCount: Object.keys(doc.paths).length,
    },
  };
}
