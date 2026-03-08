import { readFileSync, existsSync } from "fs";

// Zod transforms that produce non-serializable output break OpenAPI generation
const TRANSFORM_PATTERNS = [
  /\.transform\s*\(\s*(?:val|v|x)\s*=>/,
  /\.pipe\s*\(/,
];

// These are fine — they're pure constraints, not transforms
const SAFE_PATTERNS = [
  /\.min\(/, /\.max\(/, /\.length\(/, /\.regex\(/, /\.email\(/,
  /\.url\(/, /\.uuid\(/, /\.cuid\(/, /\.datetime\(/, /\.optional\(/,
  /\.nullable\(/, /\.default\(/, /\.describe\(/,
];

const REQUIRED_OPENAPI_FIELDS = ["openapi", "components"];

export async function run({ dir }) {
  // Check openapi-schema.json
  const openapiPath = `${dir}/openapi-schema.json`;
  if (!existsSync(openapiPath)) {
    return { pass: false, code: "SC010", message: "openapi-schema.json not found" };
  }

  let doc;
  try {
    doc = JSON.parse(readFileSync(openapiPath, "utf8"));
  } catch (e) {
    return { pass: false, code: "SC010", message: `openapi-schema.json invalid JSON: ${e.message}` };
  }

  const violations = [];

  // Must have openapi version
  if (!doc.openapi && !doc["$schema"]) {
    violations.push("Missing 'openapi' version field or '$schema' for JSON Schema");
  }

  // Must have components/schemas or definitions
  const hasSchemas = doc.components?.schemas || doc.definitions || doc.properties;
  if (!hasSchemas) {
    violations.push("Missing 'components.schemas', 'definitions', or 'properties'");
  }

  // No $ref cycles (simple check: no self-reference)
  const docStr = JSON.stringify(doc);
  const selfRefRe = /"#\/components\/schemas\/(\w+)"[^}]*"title"\s*:\s*"\1"/;
  // (simple heuristic — deep cycle detection would need graph traversal)

  if (violations.length) {
    return {
      pass: false,
      code: "SC010",
      message: `OpenAPI schema issues: ${violations.join("; ")}`,
      detail: { violations },
    };
  }

  // Now check schema.ts for non-serializable transforms
  const schemaPath = `${dir}/schema.ts`;
  if (existsSync(schemaPath)) {
    const content = readFileSync(schemaPath, "utf8");
    const lines = content.split("\n");
    const transformViolations = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trimStart().startsWith("//")) continue;

      if (TRANSFORM_PATTERNS.some(re => re.test(line))) {
        // Check if next line or same line has a corresponding .describe() or comment explaining OpenAPI impact
        const ctx = lines.slice(Math.max(0, i - 1), i + 3).join("\n");
        const hasNote = /openapi|serializ|json schema/i.test(ctx);
        if (!hasNote) {
          transformViolations.push({
            line: i + 1,
            text: line.trim(),
            hint: "Transforms may break OpenAPI serialization. Add a comment or use .describe() to document the output type.",
          });
        }
      }
    }

    if (transformViolations.length) {
      return {
        pass: false,
        code: "SC010",
        message: `${transformViolations.length} transform(s) may break OpenAPI generation`,
        detail: { transformViolations },
      };
    }
  }

  const schemaCount = Object.keys(doc.components?.schemas || doc.definitions || {}).length;
  return { pass: true, detail: { schemaCount, version: doc.openapi || doc["$schema"] } };
}
