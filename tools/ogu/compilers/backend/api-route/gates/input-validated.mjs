import { readFileSync, existsSync } from "fs";

// Patterns that indicate raw access without validation
const RAW_ACCESS_RE = /req\.(body|query|params)\s*[\.\[]/g;
// Patterns that indicate schema parsing
const PARSE_RE = /\.parse\(|\.safeParse\(|\.parseAsync\(|\.safeParseAsync\(/;
// Lines that are clearly after a parse (assignment from parse result)
const PARSED_VAR_RE = /const\s+\w+\s*=\s*\w+Schema\.(?:safe)?parse/;

export async function run({ dir }) {
  const handlerPath = `${dir}/handler.ts`;
  if (!existsSync(handlerPath)) {
    return { pass: false, code: "AR010", message: "handler.ts not found" };
  }

  const content = readFileSync(handlerPath, "utf8");
  const lines = content.split("\n");

  // Find line where schema parse happens
  const parseLineIdx = lines.findIndex(l => PARSE_RE.test(l) || PARSED_VAR_RE.test(l));

  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rawMatches = [...line.matchAll(RAW_ACCESS_RE)];
    if (rawMatches.length === 0) continue;

    // Allow raw access only if it's on or before the parse line (i.e., it IS the parse call)
    if (parseLineIdx >= 0 && i >= parseLineIdx) continue;

    // Allow if line is a parse call itself
    if (PARSE_RE.test(line) || PARSED_VAR_RE.test(line)) continue;

    // Allow comments
    if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;

    violations.push({ line: i + 1, text: line.trim() });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: "AR010",
      message: `Raw req.body/query/params access without validation: ${violations.length} instance(s)`,
      detail: { violations: violations.slice(0, 5) },
    };
  }

  if (parseLineIdx === -1) {
    // No schema parse AND no raw access — might be a very simple handler, warn but pass
    return { pass: true, detail: { warning: "No schema.parse() found — ensure inputs are validated" } };
  }

  return { pass: true, detail: { parseLine: parseLineIdx + 1 } };
}
