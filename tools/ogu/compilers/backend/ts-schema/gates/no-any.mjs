import { readFileSync, existsSync } from "fs";

// Patterns that are always forbidden
const FORBIDDEN = [
  { re: /:\s*any\b/, label: "TypeScript any annotation" },
  { re: /as\s+any\b/, label: "as any cast" },
  { re: /z\.any\s*\(\s*\)/, label: "z.any()" },
];

// Patterns that are allowed only when preceded by a justification comment
const CONDITIONAL = [
  { re: /z\.unknown\s*\(\s*\)/, label: "z.unknown()" },
  { re: /z\.record\s*\([^)]*z\.any/, label: "z.record(z.any())" },
  { re: /z\.array\s*\([^)]*z\.any/, label: "z.array(z.any())" },
];

const JUSTIFICATION_RE = /\/\/\s*(justification|reason|note|why):/i;

export async function run({ dir }) {
  const files = [`${dir}/schema.ts`, `${dir}/types.ts`].filter(f => existsSync(f));

  if (!files.length) {
    return { pass: false, code: "SC003", message: "No schema.ts or types.ts found" };
  }

  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isComment = line.trimStart().startsWith("//") || line.trimStart().startsWith("*");
      if (isComment) continue;

      // Hard forbidden
      for (const { re, label } of FORBIDDEN) {
        if (re.test(line)) {
          violations.push({ file, line: i + 1, type: label, text: line.trim() });
        }
      }

      // Conditional — allowed only if previous line has justification comment
      for (const { re, label } of CONDITIONAL) {
        if (re.test(line)) {
          const prevLine = i > 0 ? lines[i - 1] : "";
          const hasJustification = JUSTIFICATION_RE.test(prevLine);
          if (!hasJustification) {
            violations.push({
              file,
              line: i + 1,
              type: `${label} without justification comment`,
              text: line.trim(),
              hint: `Add a comment above: // justification: <reason>`,
            });
          }
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "SC003",
      message: `${violations.length} 'any' violation(s) found`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { checked: files.length } };
}
