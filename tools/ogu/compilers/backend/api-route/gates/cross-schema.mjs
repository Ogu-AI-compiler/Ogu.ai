/**
 * Gate: cross-schema
 * If schema-artifact.json exists in the feature, verify that the route's
 * input and output schemas align with the entity's field definitions.
 *
 * The schema is the source of truth. Route fields must be a subset of schema fields.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

// Fields that routes can return that don't need to be in the entity schema
const META_FIELDS = new Set([
  "_count", "__typename", "meta", "total", "page", "pageSize",
  "cursor", "hasMore", "nextCursor", "prevCursor",
]);

function extractFields(schemaShape) {
  if (!schemaShape || typeof schemaShape !== "object") return [];
  if (schemaShape.type === "object" && schemaShape.properties) {
    return Object.keys(schemaShape.properties);
  }
  // Flat object: { fieldName: type }
  return Object.keys(schemaShape).filter(k => !["type", "required", "description"].includes(k));
}

export async function run({ dir }) {
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

  const specPath = `${dir}/route-spec.json`;
  if (!existsSync(specPath)) {
    return {
      pass: true,
      skipped: true,
      detail: { reason: "No route-spec.json — run spec-valid gate first" },
    };
  }

  const schemaArtifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const routeSpec = JSON.parse(readFileSync(specPath, "utf8"));

  const schemaFields = new Set((schemaArtifact.fields || []).map(f => f.name || f));
  const violations = [];

  // Check output fields
  const outputFields = extractFields(routeSpec.output || {});
  const orphanOutput = outputFields.filter(f => !schemaFields.has(f) && !META_FIELDS.has(f));
  if (orphanOutput.length > 0) {
    violations.push({
      source: "output",
      fields: orphanOutput,
      message: `Route output has fields not in ${schemaArtifact.entity} schema: ${orphanOutput.join(", ")}`,
    });
  }

  // Check input fields (for POST/PUT/PATCH)
  const method = routeSpec.method?.toUpperCase();
  if (["POST", "PUT", "PATCH"].includes(method)) {
    const inputFields = extractFields(routeSpec.input || {});
    const orphanInput = inputFields.filter(f => !schemaFields.has(f) && !META_FIELDS.has(f));
    if (orphanInput.length > 0) {
      violations.push({
        source: "input",
        fields: orphanInput,
        message: `Route input has fields not in ${schemaArtifact.entity} schema: ${orphanInput.join(", ")}`,
      });
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: "AR012",
      message: `${violations.length} schema alignment violation(s)`,
      detail: {
        violations,
        schemaEntity: schemaArtifact.entity,
        schemaFields: [...schemaFields],
        hint: "Add missing fields to schema-spec.json and re-compile ts-schema, or remove fields from route spec",
      },
    };
  }

  return {
    pass: true,
    detail: {
      schemaEntity: schemaArtifact.entity,
      outputFields: outputFields.length,
      aligned: true,
    },
  };
}
