/**
 * Gate: cross-route
 * If route-artifact.json exists for the form's submitRoute,
 * the form's data fields must satisfy the route's input_schema.
 * Route input is the contract — form must send what the route expects.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

export async function run({ dir }) {
  const specPath = `${dir}/form-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: true, skipped: true, detail: { reason: "No form-spec.json" } };
  }

  const spec = JSON.parse(readFileSync(specPath, "utf8"));

  // Look for route-artifact.json in sibling directories
  const candidates = [
    `${dir}/route-artifact.json`,
    join(dirname(dir), "route-artifact.json"),
    join(dirname(dir), "routes", "route-artifact.json"),
    join(dirname(dir), spec.submitRoute?.replace(/^\//, "").replace(/\//g, "-") || "", "route-artifact.json"),
  ].filter(Boolean);

  const artifactPath = candidates.find(p => existsSync(p));
  if (!artifactPath) {
    return { pass: true, skipped: true, detail: { reason: "No route-artifact.json found — cross-route not enforced" } };
  }

  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  if (artifact.schema !== "route-artifact-v1") {
    return { pass: true, skipped: true, detail: { reason: `Unexpected route artifact schema: ${artifact.schema}` } };
  }

  // Verify method + path match what the form expects
  if (spec.submitRoute) {
    const routePath = artifact.path || "";
    const submitPath = spec.submitRoute.split(" ").pop(); // handle "POST /users" format
    if (!routePath.includes(submitPath) && !submitPath.includes(routePath)) {
      return {
        pass: false,
        code: "RF010",
        message: `Form submitRoute "${spec.submitRoute}" does not match route artifact path "${routePath}"`,
        detail: { submitRoute: spec.submitRoute, routePath },
      };
    }
  }

  const routeInput = artifact.input_schema;
  if (!routeInput) {
    return { pass: true, detail: { note: "Route has no input_schema — no field alignment required" } };
  }

  // Route input required fields must all be present in form fields
  const routeRequiredFields = Object.entries(routeInput.properties || {})
    .filter(([key]) => (routeInput.required || []).includes(key))
    .map(([key]) => key);

  const formFieldNames = new Set((spec.fields || []).map(f => f.name));
  const missing = routeRequiredFields.filter(f => !formFieldNames.has(f));

  if (missing.length) {
    return {
      pass: false,
      code: "RF010",
      message: `Form missing ${missing.length} field(s) required by route input schema`,
      detail: {
        missing,
        routeRequired: routeRequiredFields,
        formFields: [...formFieldNames],
        hint: "Add missing fields to form-spec.json or update the route input schema",
      },
    };
  }

  return {
    pass: true,
    detail: {
      route: `${artifact.method} ${artifact.path}`,
      routeRequiredFields,
      formSatisfied: true,
    },
  };
}
