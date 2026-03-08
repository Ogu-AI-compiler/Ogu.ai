/**
 * Gate: cross-schema
 * If page renders entity data and schema-artifact.json exists,
 * property access patterns on the data object must align with schema fields.
 * Schema is source of truth.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

export async function run({ dir }) {
  const specPath = `${dir}/page-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: true, skipped: true, detail: { reason: "No page-spec.json" } };
  }

  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  if (!spec.entity && !spec.data?.length) {
    return { pass: true, skipped: true, detail: { reason: "No entity data declared in page-spec" } };
  }

  const candidates = [
    `${dir}/schema-artifact.json`,
    join(dirname(dir), "schema-artifact.json"),
    join(dirname(dir), "schema", "schema-artifact.json"),
  ];

  const artifactPath = candidates.find(p => existsSync(p));
  if (!artifactPath) {
    return { pass: true, skipped: true, detail: { reason: "No schema-artifact.json found" } };
  }

  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  if (artifact.schema !== "schema-artifact-v1") {
    return { pass: true, skipped: true, detail: { reason: `Unexpected schema: ${artifact.schema}` } };
  }

  const schemaFields = new Set((artifact.fields || []).map(f => f.name || f));

  // Extract property accesses from Page.tsx: entity.fieldName
  const content = readFileSync(`${dir}/Page.tsx`, "utf8");
  const entityName = spec.entity || (spec.data?.[0]?.entity);
  if (!entityName) return { pass: true, skipped: true, detail: { reason: "No entity name in spec" } };

  // Find accesses like: user.email, user.name, item.title
  const varName = entityName.charAt(0).toLowerCase() + entityName.slice(1);
  const accessRe = new RegExp(`\\b${varName}\\.(\\w+)`, "g");
  const accessed = new Set([...content.matchAll(accessRe)].map(m => m[1]));

  // Filter out method calls and React-specific
  const EXEMPT = new Set(["map", "filter", "find", "forEach", "length", "toString", "id"]);
  const violations = [...accessed].filter(f => !EXEMPT.has(f) && !schemaFields.has(f));

  if (violations.length) {
    return {
      pass: false,
      code: "RP012",
      message: `${violations.length} field access(es) on "${varName}" not in schema`,
      detail: { violations, schemaFields: [...schemaFields] },
    };
  }

  return { pass: true, detail: { entity: entityName, fieldsAccessed: [...accessed] } };
}
