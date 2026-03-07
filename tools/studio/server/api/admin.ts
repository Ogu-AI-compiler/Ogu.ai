import { Hono } from "hono";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createAdminRouter() {
  const admin = new Hono();

  admin.get("/admin/stats", async (c) => {
    // Require admin role
    const user = (c as any).var?.user;
    if (process.env.AOAS_MODE === 'true' && (!user || user.role !== 'admin')) {
      return c.json({ error: "Forbidden" }, 403 as any);
    }
    try {
      const { readTable } = await import(join(__dirname, "../auth/db.mjs") as any);
      const users = readTable("users");
      const orgs = readTable("orgs");
      const usageEvents = readTable("usage_events");
      const credits = readTable("credits");
      const today = new Date().toISOString().slice(0, 7); // YYYY-MM
      const compilationsToday = usageEvents
        .filter((e: any) => e.action === 'compile' && e.month === today)
        .reduce((sum: number, e: any) => sum + e.count, 0);
      const totalCreditsBalance = credits.reduce((sum: number, c: any) => sum + c.balance, 0);
      return c.json({
        users: users.length,
        orgs: orgs.length,
        compilationsThisMonth: compilationsToday,
        totalCreditsInCirculation: totalCreditsBalance,
      });
    } catch (e: any) {
      return c.json({ error: e.message }, 500 as any);
    }
  });

  admin.get("/admin/users", async (c) => {
    const user = (c as any).var?.user;
    if (process.env.AOAS_MODE === 'true' && (!user || user.role !== 'admin')) {
      return c.json({ error: "Forbidden" }, 403 as any);
    }
    try {
      const { listUsers } = await import(join(__dirname, "../auth/user-store.mjs") as any);
      const { getUsageSummary } = await import(join(__dirname, "../billing/quota.mjs") as any);
      const { getBalance } = await import(join(__dirname, "../billing/credits.mjs") as any);
      const users = listUsers();
      const enriched = users.map((u: any) => ({
        ...u,
        usage: getUsageSummary(u.id),
        credits: getBalance(u.id),
      }));
      return c.json({ users: enriched });
    } catch (e: any) {
      return c.json({ error: e.message }, 500 as any);
    }
  });

  admin.post("/admin/users/:id/ban", async (c) => {
    const actingUser = (c as any).var?.user;
    if (process.env.AOAS_MODE === 'true' && (!actingUser || actingUser.role !== 'admin')) {
      return c.json({ error: "Forbidden" }, 403 as any);
    }
    try {
      const id = c.req.param("id");
      const { banUser } = await import(join(__dirname, "../auth/user-store.mjs") as any);
      banUser(id);
      return c.json({ ok: true, banned: id });
    } catch (e: any) {
      return c.json({ error: e.message }, 500 as any);
    }
  });

  return admin;
}
