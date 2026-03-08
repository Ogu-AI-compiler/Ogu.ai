/**
 * Gate: cross-migration
 * If the route reads/writes data (non-GET or GET with DB access),
 * verify that migration-artifact.json exists — meaning the table is compiled.
 * A route that assumes a table exists cannot ship without a verified migration.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

export async function run({ dir }) {
  const specPath = `${dir}/route-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: true, skipped: true, detail: { reason: "No route-spec.json" } };
  }

  const spec = JSON.parse(readFileSync(specPath, "utf8"));

  // Check if handler references a DB (heuristic from handler.ts)
  const handlerPath = `${dir}/handler.ts`;
  const handlerContent = existsSync(handlerPath) ? readFileSync(handlerPath, "utf8") : "";
  const usesDb = /\bdb\b|\bprisma\b|\bpool\b|\bknex\b|\bdrizzle\b|\brepository\b/i.test(handlerContent);

  if (!usesDb && spec.method === "GET") {
    return {
      pass: true,
      detail: { note: "No DB usage detected — cross-migration not required" },
    };
  }

  const candidates = [
    `${dir}/migration-artifact.json`,
    join(dirname(dir), "migration-artifact.json"),
    join(dirname(dir), "migration", "migration-artifact.json"),
    join(dirname(dir), "..", "migration", "migration-artifact.json"),
  ];

  const artifactPath = candidates.find(p => existsSync(p));

  if (!artifactPath) {
    return {
      pass: false,
      code: "AR014",
      message: "Route uses DB but no migration-artifact.json found. Compile db-migration first.",
      detail: {
        searched: candidates,
        hint: "Run: ogu compiler db-migration <slug> — then re-compile this route",
      },
    };
  }

  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

  if (artifact.schema !== "migration-artifact-v1") {
    return {
      pass: false,
      code: "AR014",
      message: `migration-artifact.json has unexpected schema: ${artifact.schema}`,
    };
  }

  return {
    pass: true,
    detail: {
      table: artifact.table,
      migrationVersion: artifact.version,
      migrationHash: artifact.attestation_hash,
    },
  };
}
