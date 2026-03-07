import { Hono } from "hono";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createOrgsRouter() {
  const orgs = new Hono();

  orgs.post("/orgs/invite", async (c) => {
    try {
      const userId = (c as any).var?.userId;
      if (!userId) return c.json({ error: "Unauthorized" }, 401 as any);
      const { email, role } = await c.req.json() as { email?: string; role?: string };
      if (!email) return c.json({ error: "email is required" }, 400 as any);
      const { getUserById } = await import(join(__dirname, "../auth/user-store.mjs") as any);
      const user = getUserById(userId);
      if (!user) return c.json({ error: "User not found" }, 404 as any);
      const { inviteMember } = await import(join(__dirname, "../auth/org-store.mjs") as any);
      const token = inviteMember(user.org_id, email, role || 'member');
      return c.json({ token, message: `Invite sent to ${email}` });
    } catch (e: any) {
      return c.json({ error: e.message }, 500 as any);
    }
  });

  orgs.post("/orgs/accept/:token", async (c) => {
    try {
      const userId = (c as any).var?.userId;
      if (!userId) return c.json({ error: "Unauthorized" }, 401 as any);
      const token = c.req.param("token");
      const { acceptInvite } = await import(join(__dirname, "../auth/org-store.mjs") as any);
      const result = acceptInvite(token, userId);
      return c.json({ ok: true, ...result });
    } catch (e: any) {
      return c.json({ error: e.message }, 400 as any);
    }
  });

  orgs.get("/orgs/members", async (c) => {
    try {
      const userId = (c as any).var?.userId;
      if (!userId) return c.json({ error: "Unauthorized" }, 401 as any);
      const { getUserById } = await import(join(__dirname, "../auth/user-store.mjs") as any);
      const user = getUserById(userId);
      if (!user) return c.json({ error: "User not found" }, 404 as any);
      const { listMembers } = await import(join(__dirname, "../auth/org-store.mjs") as any);
      const members = listMembers(user.org_id);
      return c.json({ members });
    } catch (e: any) {
      return c.json({ error: e.message }, 500 as any);
    }
  });

  orgs.delete("/orgs/members/:userId", async (c) => {
    try {
      const actorId = (c as any).var?.userId;
      if (!actorId) return c.json({ error: "Unauthorized" }, 401 as any);
      const targetId = c.req.param("userId");
      const { getUserById } = await import(join(__dirname, "../auth/user-store.mjs") as any);
      const actor = getUserById(actorId);
      if (!actor) return c.json({ error: "User not found" }, 404 as any);
      const { removeMember } = await import(join(__dirname, "../auth/org-store.mjs") as any);
      removeMember(actor.org_id, targetId);
      return c.json({ ok: true });
    } catch (e: any) {
      return c.json({ error: e.message }, 500 as any);
    }
  });

  return orgs;
}
