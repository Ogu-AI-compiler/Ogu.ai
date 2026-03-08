import { readFileSync, existsSync } from "fs";

// Match .refine(fn) and .superRefine(fn) calls
const REFINE_RE = /\.(refine|superRefine)\s*\(/g;
// Match the message param: .refine(fn, "message") or .refine(fn, { message: "..." })
const REFINE_WITH_MSG_RE = /\.(refine|superRefine)\s*\(\s*[^,)]+,\s*(?:["'`][^"'`]+["'`]|\{[^}]*message\s*:\s*["'`][^"'`]+["'`][^}]*\})/g;

export async function run({ dir }) {
  const schemaPath = `${dir}/schema.ts`;
  if (!existsSync(schemaPath)) {
    return { pass: false, code: "SC007", message: "schema.ts not found" };
  }

  const content = readFileSync(schemaPath, "utf8");
  const lines = content.split("\n");

  const allRefines = [...content.matchAll(REFINE_RE)];
  if (!allRefines.length) {
    return { pass: true, detail: { refines: 0, note: "No .refine() calls found" } };
  }

  const refinedWithMsg = [...content.matchAll(REFINE_WITH_MSG_RE)];
  const violations = [];

  // For each .refine( position, check if it has a message argument
  for (const match of allRefines) {
    const pos = match.index;
    const excerpt = content.slice(pos, pos + 300);
    const lineNum = content.slice(0, pos).split("\n").length;

    // Check for empty string message: .refine(fn, "") or .refine(fn, { message: "" })
    if (/\.(refine|superRefine)\s*\([^,)]+,\s*["'`]["'`]/.test(excerpt)) {
      violations.push({
        line: lineNum,
        text: lines[lineNum - 1]?.trim(),
        reason: "Empty error message in .refine()",
      });
      continue;
    }

    // Check if this refine has NO second argument at all
    // Simplified: look for the closing paren without a comma after the fn arg
    const parenContent = excerpt.match(/\.(refine|superRefine)\s*\(([^)]*)\)/)?.[2] || "";
    const hasComma = parenContent.includes(",");
    if (!hasComma && !excerpt.includes("message:")) {
      violations.push({
        line: lineNum,
        text: lines[lineNum - 1]?.trim(),
        reason: ".refine() missing error message argument",
        hint: 'Add: .refine(fn, "Descriptive error message")',
      });
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "SC007",
      message: `${violations.length} .refine() call(s) with missing or empty error message`,
      detail: { violations },
    };
  }

  return {
    pass: true,
    detail: { refines: allRefines.length, documented: allRefines.length },
  };
}
