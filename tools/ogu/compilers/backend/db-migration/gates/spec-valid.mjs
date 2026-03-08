import { readFileSync, existsSync } from "fs";

const REQUIRED = ["version", "name", "table", "operation", "columns"];
const VALID_OPS = ["create", "alter", "drop", "rename"];
const VERSION_RE = /^\d{3,}$/;

export async function run({ dir }) {
  const specPath = `${dir}/migration-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: false, code: "DM001", message: "migration-spec.json not found" };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, "utf8"));
  } catch (e) {
    return { pass: false, code: "DM001", message: `Invalid JSON: ${e.message}` };
  }

  const missing = REQUIRED.filter(f => !(f in spec));
  if (missing.length) {
    return { pass: false, code: "DM001", message: `Missing fields: ${missing.join(", ")}` };
  }

  if (!VERSION_RE.test(String(spec.version))) {
    return { pass: false, code: "DM001", message: `version must be zero-padded integer (e.g. "001"). Got: ${spec.version}` };
  }

  if (!VALID_OPS.includes(spec.operation)) {
    return { pass: false, code: "DM001", message: `operation must be one of: ${VALID_OPS.join(", ")}. Got: ${spec.operation}` };
  }

  if (!/^[a-z][a-z0-9_]*$/.test(spec.table)) {
    return { pass: false, code: "DM001", message: `table must be snake_case. Got: ${spec.table}` };
  }

  if (!Array.isArray(spec.columns) || !spec.columns.length) {
    return { pass: false, code: "DM001", message: "columns must be a non-empty array" };
  }

  for (const col of spec.columns) {
    if (!col.name || !col.type) {
      return { pass: false, code: "DM001", message: `Column missing name or type: ${JSON.stringify(col)}` };
    }
    if (!/^[a-z][a-z0-9_]*$/.test(col.name)) {
      return { pass: false, code: "DM001", message: `Column name must be snake_case: ${col.name}` };
    }
  }

  return {
    pass: true,
    detail: { version: spec.version, table: spec.table, operation: spec.operation, columns: spec.columns.length },
  };
}
