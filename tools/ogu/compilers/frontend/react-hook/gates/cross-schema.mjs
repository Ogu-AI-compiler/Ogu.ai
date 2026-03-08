/**
 * Gate: cross-schema
 * If the hook fetches/returns data and schema-artifact.json exists,
 * the returned data field names must align with schema fields.
 * Schema is source of truth.
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";

export async function run({ dir }) {
  const specPath = `${dir}/hook-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: true, skipped: true, detail: { reason: "No hook-spec.json" } };
  }

  const spec = JSON.parse(readFileSync(specPath, "utf8"));

  // Only applies to data-fetching hooks
  if (!spec.async && !spec.fetches) {
    return { pass: true, skipped: true, detail: { reason: "Hook is not a data-fetching hook" } };
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
    return { pass: true, skipped: true, detail: { reason: `Unexpected artifact schema: ${artifact.schema}` } };
  }

  const schemaFields = new Set((artifact.fields || []).map(f => f.name || f));

  // Get data fields from hook spec returns
  const returns = spec.returns || {};
  const dataFields = Object.keys(returns).filter(k =>
    !["loading", "isLoading", "isPending", "error", "isError", "refetch", "mutate", "reset", "status"].includes(k)
  );

  const violations = dataFields.filter(f => !schemaFields.has(f));

  if (violations.length) {
    return {
      pass: false,
      code: "RH010",
      message: `${violations.length} returned field(s) not found in schema-artifact`,
      detail: {
        violations,
        schemaFields: [...schemaFields],
        hint: "Update hook returns to match schema field names, or update the schema",
      },
    };
  }

  return {
    pass: true,
    detail: {
      schemaEntity: artifact.entity,
      alignedFields: dataFields,
    },
  };
}
