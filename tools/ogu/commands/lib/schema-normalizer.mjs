/**
 * Schema Normalizer — normalize schemas for comparison and merge.
 */

/**
 * Normalize a schema by sorting fields alphabetically.
 */
export function normalizeSchema(schema) {
  const sorted = {};
  const keys = Object.keys(schema.fields || {}).sort();
  for (const k of keys) {
    sorted[k] = schema.fields[k];
  }
  return { ...schema, fields: sorted };
}

/**
 * Merge two schemas, combining their fields.
 */
export function mergeSchemas(a, b) {
  return normalizeSchema({
    fields: { ...(a.fields || {}), ...(b.fields || {}) },
  });
}

/**
 * Compare two schemas and return differences.
 */
export function compareSchemas(a, b) {
  const diffs = [];
  const aFields = a.fields || {};
  const bFields = b.fields || {};
  const allKeys = new Set([...Object.keys(aFields), ...Object.keys(bFields)]);

  for (const key of allKeys) {
    const inA = key in aFields;
    const inB = key in bFields;
    if (!inA && inB) diffs.push({ type: "added", field: key, value: bFields[key] });
    else if (inA && !inB) diffs.push({ type: "removed", field: key, value: aFields[key] });
    else if (aFields[key] !== bFields[key])
      diffs.push({ type: "changed", field: key, before: aFields[key], after: bFields[key] });
  }

  return diffs;
}
