import { Hono } from "hono";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const billingDir = join(__dirname, "../billing");

export function createBillingRouter() {
  const billing = new Hono();

  billing.post("/billing/checkout", async (c) => {
    try {
      const userId = (c as any).var?.userId;
      if (!userId) return c.json({ error: "Unauthorized" }, 401 as any);
      const { plan } = await c.req.json() as { plan?: string };
      if (!plan) return c.json({ error: "plan is required" }, 400 as any);
      const { createCheckoutSession } = await import(join(billingDir, "stripe.mjs") as any);
      const result = await createCheckoutSession(userId, plan);
      return c.json(result);
    } catch (e: any) {
      return c.json({ error: e.message }, 500 as any);
    }
  });

  billing.post("/billing/portal", async (c) => {
    try {
      const userId = (c as any).var?.userId;
      if (!userId) return c.json({ error: "Unauthorized" }, 401 as any);
      const { createPortalSession } = await import(join(billingDir, "stripe.mjs") as any);
      const result = await createPortalSession(userId);
      return c.json(result);
    } catch (e: any) {
      return c.json({ error: e.message }, 500 as any);
    }
  });

  billing.get("/billing/subscription", async (c) => {
    try {
      const userId = (c as any).var?.userId;
      if (!userId) return c.json({ error: "Unauthorized" }, 401 as any);
      const { getUserById } = await import(join(__dirname, "../auth/user-store.mjs") as any);
      const { getBalance } = await import(join(billingDir, "credits.mjs") as any);
      const { getUsageSummary } = await import(join(billingDir, "quota.mjs") as any);
      const { getPlan } = await import(join(billingDir, "plans.mjs") as any);
      const user = getUserById(userId);
      if (!user) return c.json({ error: "User not found" }, 404 as any);
      const plan = getPlan(user.plan);
      const balance = getBalance(userId);
      const usage = getUsageSummary(userId);
      return c.json({ plan, balance, usage });
    } catch (e: any) {
      return c.json({ error: e.message }, 500 as any);
    }
  });

  billing.get("/billing/credits", async (c) => {
    try {
      const userId = (c as any).var?.userId;
      if (!userId) return c.json({ error: "Unauthorized" }, 401 as any);
      const { getBalance, getTransactions } = await import(join(billingDir, "credits.mjs") as any);
      return c.json({ balance: getBalance(userId), transactions: getTransactions(userId) });
    } catch (e: any) {
      return c.json({ error: e.message }, 500 as any);
    }
  });

  billing.post("/billing/credits/deduct", async (c) => {
    try {
      const userId = (c as any).var?.userId;
      if (!userId) return c.json({ error: "Unauthorized" }, 401 as any);
      const { amount, reason } = await c.req.json() as { amount?: number; reason?: string };
      if (!amount || amount <= 0) return c.json({ error: "amount must be positive" }, 400 as any);
      const { deductCredits } = await import(join(billingDir, "credits.mjs") as any);
      const result = deductCredits(userId, amount, reason);
      return c.json(result);
    } catch (e: any) {
      return c.json({ error: e.message }, 500 as any);
    }
  });

  return billing;
}
