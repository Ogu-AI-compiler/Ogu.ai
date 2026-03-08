/**
 * Gate: auth-schemes
 * Every security scheme name used in route operations must be
 * defined in components/securitySchemes.
 */
import { readFileSync, existsSync } from "fs";

function collectSecurityRefs(obj, refs = new Set()) {
  if (!obj || typeof obj !== "object") return refs;
  if (Array.isArray(obj)) { obj.forEach(i => collectSecurityRefs(i, refs)); return refs; }
  // security arrays look like: [{ "bearerAuth": [] }]
  if ("security" in obj && Array.isArray(obj.security)) {
    for (const entry of obj.security) {
      if (typeof entry === "object") Object.keys(entry).forEach(k => refs.add(k));
    }
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k !== "security") collectSecurityRefs(v, refs);
  }
  return refs;
}

export async function run({ dir }) {
  const docPath = `${dir}/openapi.json`;
  if (!existsSync(docPath)) {
    return { pass: true, skipped: true, detail: { reason: "openapi.json not assembled yet" } };
  }

  const doc = JSON.parse(readFileSync(docPath, "utf8"));
  const defined = new Set(Object.keys(doc.components?.securitySchemes || {}));

  // Collect from global + per-operation security
  const refs = collectSecurityRefs(doc);

  const undefined_ = [...refs].filter(name => !defined.has(name));

  if (undefined_.length) {
    return {
      pass: false,
      code: "OS008",
      message: `${undefined_.length} security scheme(s) used but not defined in components/securitySchemes`,
      detail: {
        undefined: undefined_,
        defined: [...defined],
        hint: "Add missing schemes to components/securitySchemes (e.g. bearerAuth: { type: http, scheme: bearer })",
      },
    };
  }

  return { pass: true, detail: { schemesUsed: [...refs], schemesDefined: [...defined] } };
}
