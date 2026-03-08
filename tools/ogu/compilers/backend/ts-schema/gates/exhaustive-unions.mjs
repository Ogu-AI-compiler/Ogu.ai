import { readFileSync, existsSync } from "fs";

// Detect z.union([z.object(...), z.object(...)]) — the problematic pattern
// z.discriminatedUnion("field", [...]) is the correct one
const UNION_OF_OBJECTS_RE = /z\.union\s*\(\s*\[[\s\S]*?z\.object\s*\(/g;
const DISCRIMINATED_RE = /z\.discriminatedUnion\s*\(/g;

export async function run({ dir }) {
  const schemaPath = `${dir}/schema.ts`;
  if (!existsSync(schemaPath)) {
    return { pass: false, code: "SC006", message: "schema.ts not found" };
  }

  const content = readFileSync(schemaPath, "utf8");
  const violations = [];

  // Find all z.union( usages
  const unionMatches = [...content.matchAll(/z\.union\s*\(\s*\[/g)];

  for (const match of unionMatches) {
    const start = match.index;
    // Grab the next ~300 chars to check if it contains z.object
    const excerpt = content.slice(start, start + 300);

    if (/z\.object\s*\(/.test(excerpt)) {
      // Find line number
      const before = content.slice(0, start);
      const lineNum = before.split("\n").length;
      const lineText = content.split("\n")[lineNum - 1]?.trim();

      violations.push({
        line: lineNum,
        text: lineText,
        hint: "Use z.discriminatedUnion('type', [...]) instead of z.union([z.object(...), z.object(...)])",
      });
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "SC006",
      message: `${violations.length} discriminated union(s) using z.union() instead of z.discriminatedUnion()`,
      detail: { violations },
    };
  }

  // Check that discriminatedUnion calls have a discriminator field string
  const discMatches = [...content.matchAll(/z\.discriminatedUnion\s*\(\s*["'](\w+)["']/g)];
  for (const match of discMatches) {
    if (!match[1]) {
      const lineNum = content.slice(0, match.index).split("\n").length;
      violations.push({ line: lineNum, text: match[0], hint: "discriminatedUnion missing discriminator field name" });
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "SC006",
      message: `${violations.length} discriminatedUnion() missing discriminator field`,
      detail: { violations },
    };
  }

  return {
    pass: true,
    detail: {
      unions: unionMatches.length,
      discriminatedUnions: discMatches.length,
    },
  };
}
