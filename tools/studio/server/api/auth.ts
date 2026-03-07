import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Dynamic import helper for .mjs auth modules
async function getAuthService() {
  const { register, login, refresh, getMe, logout } = await import(
    /* @vite-ignore */ join(__dirname, "../auth/auth-service.mjs") as any
  );
  return { register, login, refresh, getMe, logout };
}

export function createAuthRouter() {
  const auth = new Hono();

  auth.post("/auth/register", async (c) => {
    try {
      const body = await c.req.json() as { email?: string; password?: string; name?: string; orgName?: string };
      const { register } = await getAuthService();
      const result = await register(body);
      setCookie(c, "ogu-refresh-token", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
      });
      return c.json({ user: result.user, accessToken: result.accessToken });
    } catch (e: any) {
      return c.json({ error: e.message }, 400 as any);
    }
  });

  auth.post("/auth/login", async (c) => {
    try {
      const body = await c.req.json() as { email?: string; password?: string };
      const { login } = await getAuthService();
      const result = await login(body);
      setCookie(c, "ogu-refresh-token", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
      });
      return c.json({ user: result.user, accessToken: result.accessToken });
    } catch (e: any) {
      return c.json({ error: e.message }, 401 as any);
    }
  });

  auth.post("/auth/refresh", async (c) => {
    try {
      const cookie = getCookie(c, "ogu-refresh-token");
      const body = await c.req.json().catch(() => ({})) as { refreshToken?: string };
      const token = cookie || body.refreshToken;
      if (!token) return c.json({ error: "No refresh token" }, 401 as any);
      const { refresh } = await getAuthService();
      const result = await refresh(token);
      return c.json(result);
    } catch (e: any) {
      return c.json({ error: e.message }, 401 as any);
    }
  });

  auth.get("/auth/me", async (c) => {
    try {
      const userId = (c as any).var?.userId;
      if (!userId) return c.json({ error: "Not authenticated" }, 401 as any);
      const { getMe } = await getAuthService();
      const result = await getMe(userId);
      return c.json(result);
    } catch (e: any) {
      return c.json({ error: e.message }, 404 as any);
    }
  });

  auth.post("/auth/logout", async (c) => {
    const cookie = getCookie(c, "ogu-refresh-token");
    if (cookie) {
      const { logout } = await getAuthService();
      await logout(cookie);
    }
    deleteCookie(c, "ogu-refresh-token");
    return c.json({ ok: true });
  });

  return auth;
}
