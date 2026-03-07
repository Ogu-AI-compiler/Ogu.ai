import type { MiddlewareHandler } from "hono";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function getJwt() {
  const { extractBearerToken, verifyToken } = await import(
    /* @vite-ignore */ join(__dirname, "../auth/jwt.mjs") as any
  );
  return { extractBearerToken, verifyToken };
}

async function getApiKeys() {
  const { validateApiKey } = await import(
    /* @vite-ignore */ join(__dirname, "../auth/api-keys.mjs") as any
  );
  return { validateApiKey };
}

/**
 * requireAuth — validates Bearer JWT or X-API-Key.
 * Attaches ctx.var.user and ctx.var.userId.
 * Returns 401 if missing or invalid.
 */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  // Skip auth in local dev without AOAS_MODE
  if (!process.env.AOAS_MODE || process.env.AOAS_MODE === 'false') {
    await next();
    return;
  }

  const { extractBearerToken, verifyToken } = await getJwt();

  // Try Bearer token first
  const authHeader = c.req.header("Authorization");
  const bearerToken = extractBearerToken(authHeader);

  if (bearerToken) {
    const payload = verifyToken(bearerToken);
    if (payload && payload.type === 'access') {
      (c as any).set("userId", payload.userId);
      (c as any).set("user", payload);
      await next();
      return;
    }
  }

  // Try X-API-Key header
  const apiKey = c.req.header("X-API-Key");
  if (apiKey) {
    const { validateApiKey } = await getApiKeys();
    const userId = await validateApiKey(apiKey);
    if (userId) {
      (c as any).set("userId", userId);
      (c as any).set("user", { userId, type: "api_key" });
      await next();
      return;
    }
  }

  return c.json({ error: "Unauthorized" }, 401 as any);
};

/**
 * optionalAuth — attaches user if token valid, no error if missing.
 */
export const optionalAuth: MiddlewareHandler = async (c, next) => {
  if (!process.env.AOAS_MODE || process.env.AOAS_MODE === 'false') {
    await next();
    return;
  }

  const { extractBearerToken, verifyToken } = await getJwt();
  const authHeader = c.req.header("Authorization");
  const token = extractBearerToken(authHeader);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      (c as any).set("userId", payload.userId);
      (c as any).set("user", payload);
    }
  }
  await next();
};

/**
 * requireAdmin — must be authenticated AND have role='admin'.
 */
export const requireAdmin: MiddlewareHandler = async (c, next) => {
  if (!process.env.AOAS_MODE || process.env.AOAS_MODE === 'false') {
    await next();
    return;
  }
  const user = (c as any).var?.user;
  if (!user) return c.json({ error: "Unauthorized" }, 401 as any);
  if (user.role !== 'admin') return c.json({ error: "Forbidden" }, 403 as any);
  await next();
};
