/**
 * Gate: cross-auth
 * If the route requires auth, verify that auth-artifact.json exists
 * and was successfully compiled. A protected route cannot ship without
 * a verified auth middleware.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

export async function run({ dir }) {
  const specPath = `${dir}/route-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: true, skipped: true, detail: { reason: "No route-spec.json" } };
  }

  const spec = JSON.parse(readFileSync(specPath, "utf8"));

  // Public routes don't need auth middleware
  if (!spec.auth || spec.auth === "none") {
    return { pass: true, detail: { auth: "none", note: "Public route — no auth middleware required" } };
  }

  // Look for auth-artifact.json
  const candidates = [
    `${dir}/auth-artifact.json`,
    join(dirname(dir), "auth-artifact.json"),
    join(dirname(dir), "auth", "auth-artifact.json"),
    join(dirname(dir), "..", "auth", "auth-artifact.json"),
  ];

  const artifactPath = candidates.find(p => existsSync(p));

  if (!artifactPath) {
    return {
      pass: false,
      code: "AR013",
      message: `Route requires auth="${spec.auth}" but no auth-artifact.json found. Compile auth-middleware first.`,
      detail: {
        searched: candidates,
        hint: "Run: ogu compiler auth-middleware <slug> — then re-compile this route",
      },
    };
  }

  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

  // Verify the artifact schema is correct
  if (artifact.schema !== "auth-artifact-v1") {
    return {
      pass: false,
      code: "AR013",
      message: `auth-artifact.json has unexpected schema: ${artifact.schema}`,
    };
  }

  // Verify required exports are present
  const requiredExports = ["requireAuth", "AuthError", "TokenExpiredError"];
  const missingExports = requiredExports.filter(e => !(artifact.exports || []).includes(e));
  if (missingExports.length) {
    return {
      pass: false,
      code: "AR013",
      message: `auth-artifact missing required exports: ${missingExports.join(", ")}`,
    };
  }

  return {
    pass: true,
    detail: {
      authStrategy: artifact.strategy,
      authHash: artifact.attestation_hash,
      routeAuth: spec.auth,
    },
  };
}
