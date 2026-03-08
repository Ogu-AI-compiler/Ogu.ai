import { readFileSync, existsSync } from "fs";

const VALID_STRATEGIES = ["jwt", "session", "api-key", "oauth2", "basic"];
const REQUIRED = ["strategy", "tokenShape", "expiry", "refresh"];

export async function run({ dir }) {
  const specPath = `${dir}/auth-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: false, code: "AM001", message: "auth-spec.json not found" };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, "utf8"));
  } catch (e) {
    return { pass: false, code: "AM001", message: `auth-spec.json invalid JSON: ${e.message}` };
  }

  const missing = REQUIRED.filter(f => !(f in spec));
  if (missing.length) {
    return { pass: false, code: "AM001", message: `Missing fields: ${missing.join(", ")}` };
  }

  if (!VALID_STRATEGIES.includes(spec.strategy)) {
    return { pass: false, code: "AM001", message: `strategy must be one of: ${VALID_STRATEGIES.join(", ")}. Got: ${spec.strategy}` };
  }

  if (typeof spec.expiry !== "object" || !spec.expiry.accessToken) {
    return { pass: false, code: "AM001", message: "expiry must be an object with at least accessToken duration (e.g. '15m')" };
  }

  if (typeof spec.refresh !== "boolean" && typeof spec.refresh !== "object") {
    return { pass: false, code: "AM001", message: "refresh must be boolean or object with refreshToken duration" };
  }

  return {
    pass: true,
    detail: { strategy: spec.strategy, expiry: spec.expiry, refresh: spec.refresh },
  };
}
