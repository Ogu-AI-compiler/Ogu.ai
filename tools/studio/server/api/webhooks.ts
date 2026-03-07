import { Hono } from "hono";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHmac } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

function verifyStripeSignature(payload: string, sigHeader: string, secret: string): boolean {
  try {
    const parts = sigHeader.split(",");
    const ts = parts.find(p => p.startsWith("t="))?.slice(2);
    const v1 = parts.find(p => p.startsWith("v1="))?.slice(3);
    if (!ts || !v1) return false;
    const signed = `${ts}.${payload}`;
    const expected = createHmac("sha256", secret).update(signed).digest("hex");
    return expected === v1;
  } catch {
    return false;
  }
}

export function createWebhooksRouter() {
  const webhooks = new Hono();

  webhooks.post("/webhooks/stripe", async (c) => {
    const payload = await c.req.text();
    const sig = c.req.header("stripe-signature") || "";
    const secret = process.env.STRIPE_WEBHOOK_SECRET || "mock-secret";

    // In real mode, verify signature
    if (process.env.STRIPE_WEBHOOK_SECRET && !verifyStripeSignature(payload, sig, secret)) {
      return c.json({ error: "Invalid signature" }, 400 as any);
    }

    let event;
    try {
      event = JSON.parse(payload);
    } catch {
      return c.json({ error: "Invalid JSON" }, 400 as any);
    }

    const billingDir = join(__dirname, "../billing");

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const { handleCheckoutCompleted } = await import(join(billingDir, "stripe.mjs") as any);
          await handleCheckoutCompleted(event.data.object);
          break;
        }
        case "customer.subscription.updated": {
          const sub = event.data.object;
          const plan = sub.metadata?.plan || "pro";
          const { readTable, writeTable } = await import(join(__dirname, "../auth/db.mjs") as any);
          const orgs = readTable("orgs");
          const org = orgs.find((o: any) => o.stripe_customer_id === sub.customer);
          if (org) {
            const users = readTable("users");
            const user = users.find((u: any) => u.org_id === org.id);
            if (user) {
              const { updateUserPlan } = await import(join(__dirname, "../auth/user-store.mjs") as any);
              updateUserPlan(user.id, plan);
            }
          }
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object;
          const { readTable } = await import(join(__dirname, "../auth/db.mjs") as any);
          const orgs = readTable("orgs");
          const org = orgs.find((o: any) => o.stripe_customer_id === sub.customer);
          if (org) {
            const users = readTable("users");
            const user = users.find((u: any) => u.org_id === org.id);
            if (user) {
              const { updateUserPlan } = await import(join(__dirname, "../auth/user-store.mjs") as any);
              updateUserPlan(user.id, "free");
            }
          }
          break;
        }
        case "invoice.payment_failed": {
          // Could restrict quota or notify user — for now log
          console.warn("[webhooks] Payment failed for customer:", event.data.object.customer);
          break;
        }
        default:
          console.log("[webhooks] Unhandled event type:", event.type);
      }
    } catch (e: any) {
      console.error("[webhooks] Handler error:", e.message);
    }

    return c.json({ received: true });
  });

  return webhooks;
}
