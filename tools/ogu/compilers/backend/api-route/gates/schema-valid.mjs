import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const schemaPath = `${dir}/schema.ts`;
  if (!existsSync(schemaPath)) {
    return { pass: false, code: "AR002", message: "schema.ts not found" };
  }

  const content = readFileSync(schemaPath, "utf8");

  const hasInputSchema = /export\s+(const|type|interface)\s+InputSchema/.test(content) ||
    /export\s+\{[^}]*InputSchema[^}]*\}/.test(content);

  const hasOutputSchema = /export\s+(const|type|interface)\s+OutputSchema/.test(content) ||
    /export\s+\{[^}]*OutputSchema[^}]*\}/.test(content);

  const missing = [];
  if (!hasInputSchema) missing.push("InputSchema");
  if (!hasOutputSchema) missing.push("OutputSchema");

  if (missing.length) {
    return {
      pass: false,
      code: "AR002",
      message: `schema.ts missing exports: ${missing.join(", ")}`,
    };
  }

  // Check for obvious syntax errors (unbalanced braces)
  const opens = (content.match(/\{/g) || []).length;
  const closes = (content.match(/\}/g) || []).length;
  if (Math.abs(opens - closes) > 2) {
    return { pass: false, code: "AR002", message: "schema.ts appears to have unbalanced braces" };
  }

  return { pass: true, detail: { hasInputSchema, hasOutputSchema } };
}
