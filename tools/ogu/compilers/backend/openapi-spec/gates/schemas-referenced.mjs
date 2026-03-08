/**
 * Gate: schemas-referenced
 * All $ref values pointing to #/components/schemas/* must be defined.
 * Already covered by openapi-valid's ref check, but this gate is explicit
 * and reports schema-specific violations with friendlier messages.
 */
import { readFileSync, existsSync } from "fs";

function collectSchemaRefs(obj, refs = new Set()) {
  if (!obj || typeof obj !== "object") return refs;
  if (Array.isArray(obj)) { obj.forEach(i => collectSchemaRefs(i, refs)); return refs; }
  for (const [k, v] of Object.entries(obj)) {
    if (k === "$ref" && typeof v === "string" && v.startsWith("#/components/schemas/")) refs.add(v);
    else collectSchemaRefs(v, refs);
  }
  return refs;
}

export async function run({ dir }) {
  const docPath = `${dir}/openapi.json`;
  if (!existsSync(docPath)) {
    return { pass: true, skipped: true, detail: { reason: "openapi.json not assembled yet" } };
  }

  const doc = JSON.parse(readFileSync(docPath, "utf8"));
  const schemas = doc.components?.schemas || {};
  const definedSchemas = new Set(Object.keys(schemas));

  const refs = collectSchemaRefs(doc.paths);
  const dangling = [...refs]
    .map(ref => ref.replace("#/components/schemas/", ""))
    .filter(name => !definedSchemas.has(name));

  if (dangling.length) {
    return {
      pass: false,
      code: "OS007",
      message: `${dangling.length} schema(s) referenced but not defined in components/schemas`,
      detail: {
        dangling,
        defined: [...definedSchemas],
        hint: "Add missing schemas to components/schemas or remove the $ref",
      },
    };
  }

  return { pass: true, detail: { schemaCount: definedSchemas.size, refsChecked: refs.size } };
}
