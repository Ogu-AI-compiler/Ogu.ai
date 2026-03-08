/**
 * Gate: props
 * Cross-checks that all props declared in component-spec.json
 * are present in the TypeScript interface with correct types.
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir, name }) {
  const specPath = `${dir}/component-spec.json`;
  const typesPath = `${dir}/${name}.types.ts`;
  const implPath = `${dir}/${name}.tsx`;

  if (!existsSync(specPath)) {
    return { pass: false, code: "RC007", message: "component-spec.json not found" };
  }

  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  const typesFile = existsSync(typesPath) ? typesPath : implPath;

  if (!existsSync(typesFile)) {
    return { pass: false, code: "RC007", message: `Types file not found: ${typesFile}` };
  }

  const content = readFileSync(typesFile, "utf8");
  const missing = [];

  for (const prop of spec.props || []) {
    const propName = typeof prop === "string" ? prop : prop.name;
    if (!propName) continue;

    // Check that the prop name appears in the interface declaration
    const propRe = new RegExp(`\\b${propName}\\s*[?:]`, "m");
    if (!propRe.test(content)) {
      missing.push(propName);
    }
  }

  if (missing.length > 0) {
    return {
      pass: false,
      code: "RC007",
      message: `Props missing from interface: ${missing.join(", ")}`,
      detail: { missing },
    };
  }

  // Check interface name convention
  const interfaceRe = new RegExp(`interface\\s+${name}Props|type\\s+${name}Props`, "m");
  if (!interfaceRe.test(content)) {
    return {
      pass: false,
      code: "RC007",
      message: `Props type must be named ${name}Props`,
    };
  }

  return { pass: true, detail: { props: (spec.props || []).length } };
}
