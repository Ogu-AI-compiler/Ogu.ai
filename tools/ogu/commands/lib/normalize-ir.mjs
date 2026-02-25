// Shared IR identifier normalization.
// Used by: orchestrate.mjs, feature.mjs, gates.mjs, drift.mjs, ir-registry.mjs

/**
 * Normalize an IR identifier to a canonical form.
 * "API:/Users/ GET" → "API:/users GET"
 */
export function normalizeIR(identifier) {
  if (!identifier || typeof identifier !== "string") return identifier;
  let [type, ...rest] = identifier.split(":");
  let id = rest.join(":");
  type = type.toUpperCase();
  // Strip trailing slashes
  id = id.replace(/\/+$/, "");
  // Collapse multiple slashes: /users//profile → /users/profile
  id = id.replace(/\/{2,}/g, "/");
  // Lowercase path portion (before method)
  const parts = id.split(" ");
  parts[0] = parts[0].toLowerCase();
  // Uppercase method portion if exists: "get" → "GET"
  if (parts[1]) parts[1] = parts[1].toUpperCase();
  return `${type}:${parts.join(" ")}`;
}

/**
 * Strip route params for conflict matching.
 * "ROUTE:/users/:id" → "ROUTE:/users"
 */
export function normalizeRouteForConflict(route) {
  return route.replace(/\/:[^/]+/g, "");
}
