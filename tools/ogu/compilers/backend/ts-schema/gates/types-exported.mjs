import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const schemaPath = `${dir}/schema.ts`;
  const typesPath = `${dir}/types.ts`;

  if (!existsSync(schemaPath)) {
    return { pass: false, code: "SC004", message: "schema.ts not found" };
  }

  const schemaContent = readFileSync(schemaPath, "utf8");
  const typesContent = existsSync(typesPath) ? readFileSync(typesPath, "utf8") : "";
  const combined = schemaContent + "\n" + typesContent;

  // Find all exported schemas: export const FooSchema = z...
  const schemaNames = [...schemaContent.matchAll(/export\s+const\s+(\w+Schema)\s*=/g)]
    .map(m => m[1]);

  if (!schemaNames.length) {
    return { pass: false, code: "SC004", message: "No exported schemas found in schema.ts" };
  }

  // For each XxxSchema, check there's a corresponding: export type Xxx = z.infer<typeof XxxSchema>
  const missing = [];
  for (const schemaName of schemaNames) {
    const typeName = schemaName.replace(/Schema$/, "");
    // Match: export type Foo = z.infer<typeof FooSchema>
    const typeRe = new RegExp(`export\\s+type\\s+${typeName}\\s*=\\s*z\\.infer\\s*<\\s*typeof\\s+${schemaName}\\s*>`);
    if (!typeRe.test(combined)) {
      missing.push({ schema: schemaName, expectedType: typeName });
    }
  }

  if (missing.length) {
    return {
      pass: false,
      code: "SC004",
      message: `${missing.length} schema(s) missing exported type`,
      detail: {
        missing,
        hint: missing.map(m => `export type ${m.expectedType} = z.infer<typeof ${m.schema}>;`),
      },
    };
  }

  return {
    pass: true,
    detail: { schemas: schemaNames.length, types: schemaNames.length },
  };
}
