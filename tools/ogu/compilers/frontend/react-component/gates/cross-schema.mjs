/**
 * Gate: cross-schema
 * If schema-artifact.json exists in the feature, verify that component
 * props align with the schema's field definitions.
 *
 * The schema is the source of truth. Props that carry data must exist
 * as fields in the schema. Meta/UI props (className, onClick, etc.) are exempt.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

// Props that are UI/meta and don't need a schema field
const META_PROPS = new Set([
  "className", "style", "children", "ref", "key", "id",
  "onClick", "onChange", "onSubmit", "onBlur", "onFocus",
  "onKeyDown", "onKeyUp", "onMouseEnter", "onMouseLeave",
  "disabled", "loading", "isLoading", "aria-label", "aria-labelledby",
  "aria-describedby", "role", "tabIndex", "data-testid",
  "variant", "size", "color", "align", "as", "href", "target",
]);

export async function run({ dir, name }) {
  // Search for schema-artifact.json: same dir, parent, or parent/schema
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

  const specPath = `${dir}/component-spec.json`;
  if (!existsSync(specPath)) {
    return {
      pass: true,
      skipped: true,
      detail: { reason: "No component-spec.json — run spec-valid gate first" },
    };
  }

  const schemaArtifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const componentSpec = JSON.parse(readFileSync(specPath, "utf8"));

  const schemaFields = new Set((schemaArtifact.fields || []).map(f => f.name || f));
  const componentProps = (componentSpec.props || []).map(p => p.name || p);

  // Data props = all props minus meta/UI props
  const dataProps = componentProps.filter(p => !META_PROPS.has(p));

  // Every data prop must exist in the schema
  const violations = dataProps.filter(p => !schemaFields.has(p));

  if (violations.length > 0) {
    return {
      pass: false,
      code: "RC011",
      message: `${violations.length} prop(s) not found in ${schemaArtifact.entity} schema: ${violations.join(", ")}`,
      detail: {
        violations,
        schemaEntity: schemaArtifact.entity,
        schemaFields: [...schemaFields],
        hint: `Add missing fields to schema-spec.json and re-compile ts-schema, or remove props from component`,
      },
    };
  }

  return {
    pass: true,
    detail: {
      schemaEntity: schemaArtifact.entity,
      dataProps: dataProps.length,
      aligned: dataProps.length,
    },
  };
}
