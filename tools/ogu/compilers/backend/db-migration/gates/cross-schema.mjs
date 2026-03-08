/**
 * Gate: cross-schema
 * Schema-artifact is the source of truth.
 * Migration columns must align with schema fields.
 * Every non-meta schema field must have a column. Every column must map to a schema field.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

// Columns that are structural/meta — not in the schema entity fields
const META_COLUMNS = new Set(["created_at", "updated_at", "deleted_at", "id"]);

// Mapping from schema field types to expected SQL type prefixes
const TYPE_MAP = {
  uuid:    ["UUID", "VARCHAR(36)", "CHAR(36)"],
  email:   ["VARCHAR", "TEXT"],
  string:  ["VARCHAR", "TEXT", "CHAR"],
  number:  ["INTEGER", "INT", "BIGINT", "DECIMAL", "NUMERIC", "FLOAT", "DOUBLE"],
  boolean: ["BOOLEAN", "BOOL", "TINYINT(1)"],
  date:    ["TIMESTAMP", "DATETIME", "DATE", "TIMESTAMPTZ"],
  enum:    ["VARCHAR", "TEXT", "ENUM"],
  object:  ["JSONB", "JSON", "TEXT"],
  array:   ["JSONB", "JSON", "TEXT"],
};

function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`).replace(/^_/, "");
}

export async function run({ dir }) {
  const specPath = `${dir}/migration-spec.json`;
  const candidates = [
    `${dir}/schema-artifact.json`,
    join(dirname(dir), "schema-artifact.json"),
    join(dirname(dir), "schema", "schema-artifact.json"),
  ];
  const artifactPath = candidates.find(p => existsSync(p));

  if (!artifactPath) {
    return {
      pass: true,
      skipped: true,
      detail: { reason: "No schema-artifact.json found — compile ts-schema first" },
    };
  }

  if (!existsSync(specPath)) {
    return { pass: false, code: "DM002", message: "migration-spec.json not found" };
  }

  const schemaArtifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const spec = JSON.parse(readFileSync(specPath, "utf8"));

  const schemaFields = (schemaArtifact.fields || []).map(f => ({
    name: toSnakeCase(f.name || f),
    type: f.type || "string",
  }));
  const schemaFieldNames = new Set(schemaFields.map(f => f.name));

  const migrationColumns = (spec.columns || []).map(c => c.name);
  const migrationColumnSet = new Set(migrationColumns);

  const violations = [];

  // Every schema field (non-meta) must have a column
  for (const field of schemaFields) {
    if (META_COLUMNS.has(field.name)) continue;
    if (!migrationColumnSet.has(field.name)) {
      violations.push({
        type: "missing-column",
        message: `Schema field '${field.name}' has no corresponding column in migration`,
      });
    }
  }

  // Every non-meta column must map to a schema field
  for (const col of migrationColumns) {
    if (META_COLUMNS.has(col)) continue;
    if (!schemaFieldNames.has(col)) {
      violations.push({
        type: "orphan-column",
        message: `Column '${col}' has no corresponding field in schema '${schemaArtifact.entity}'`,
      });
    }
  }

  // Type compatibility check
  for (const field of schemaFields) {
    if (META_COLUMNS.has(field.name)) continue;
    const col = spec.columns.find(c => c.name === field.name);
    if (!col) continue;
    const expectedTypes = TYPE_MAP[field.type] || [];
    if (expectedTypes.length && !expectedTypes.some(t => col.type.toUpperCase().startsWith(t))) {
      violations.push({
        type: "type-mismatch",
        message: `Column '${col.name}' type '${col.type}' incompatible with schema type '${field.type}'. Expected one of: ${expectedTypes.join(", ")}`,
      });
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "DM002",
      message: `${violations.length} schema alignment violation(s)`,
      detail: { violations, schemaEntity: schemaArtifact.entity },
    };
  }

  return {
    pass: true,
    detail: {
      schemaEntity: schemaArtifact.entity,
      schemaFields: schemaFields.length,
      columns: migrationColumns.length,
      aligned: true,
    },
  };
}
