/**
 * Gate: spec-valid
 * page-spec.json must exist with: name, route, layout, auth.
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const specPath = `${dir}/page-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: false, code: "RP001", message: "page-spec.json not found" };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, "utf8"));
  } catch (err) {
    return { pass: false, code: "RP001", message: `page-spec.json parse error: ${err.message}` };
  }

  const missing = [];
  if (!spec.name) missing.push("name");
  if (!spec.route) missing.push("route");
  if (!spec.layout) missing.push("layout");
  if (!spec.auth) missing.push("auth");

  if (missing.length) {
    return {
      pass: false,
      code: "RP001",
      message: `page-spec.json missing: ${missing.join(", ")}`,
      detail: { missing },
    };
  }

  return {
    pass: true,
    detail: {
      name: spec.name,
      route: spec.route,
      layout: spec.layout,
      auth: spec.auth,
      hasParams: !!(spec.params?.length),
      hasData: !!(spec.data?.length),
    },
  };
}
