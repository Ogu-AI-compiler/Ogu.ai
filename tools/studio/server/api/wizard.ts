/**
 * Wizard API — AI-driven archetype classification and question personalization.
 *
 * Two endpoints:
 *   POST /wizard/classify     — Classify free text into archetypes
 *   POST /wizard/personalize  — Personalize step questions with LLM
 *
 * Uses Haiku for speed + low cost. Budget tracked via model-bridge.
 */

import { Hono } from "hono";
import { computeCost, recordChatSpend } from "./model-bridge.js";

const MODEL_IDS: Record<string, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-6",
};
const API_URL = "https://api.anthropic.com/v1/messages";

function getRoot(): string {
  return process.env.OGU_ROOT || process.cwd();
}

const LANG_RULE = "\n\nIMPORTANT: Always respond in English regardless of the user's language.";

export async function callLLM(
  model: "haiku" | "sonnet" | "opus",
  system: string,
  userMessage: string,
  maxTokens = 1024,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const modelId = MODEL_IDS[model];
  const fullSystem = system + LANG_RULE;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: maxTokens,
      system: fullSystem,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body}`);
  }

  const data = await res.json() as any;
  return {
    text: data.content?.[0]?.text || "",
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };
}

export function parseJSON(text: string): any {
  // Try direct parse first
  try { return JSON.parse(text); } catch {}

  // Extract from markdown code block
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }

  // Try finding first { to last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = text.slice(start, end + 1);
    try { return JSON.parse(slice); } catch {}

    // Response was likely truncated — try to repair by closing open brackets
    try { return JSON.parse(repairJSON(slice)); } catch {}
  }

  // Last resort: if there's a { but no closing }, try repairing from start
  if (start >= 0) {
    try { return JSON.parse(repairJSON(text.slice(start))); } catch {}
  }

  throw new Error("Failed to parse LLM response as JSON");
}

/** Repair truncated JSON by closing open brackets/braces/strings */
function repairJSON(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (const ch of text) {
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") stack.pop();
  }

  // If we're mid-string, close it
  let repaired = text;
  if (inString) repaired += '"';
  // Close any trailing comma before closing
  repaired = repaired.replace(/,\s*$/, "");
  // Close all open containers
  repaired += stack.reverse().join("");
  return repaired;
}

export function createWizardRouter() {
  const router = new Hono();

  // ── POST /wizard/classify ──
  router.post("/wizard/classify", async (c) => {
    const body = await c.req.json<{ mode: string; description: string }>();
    const { mode, description } = body;

    if (!mode || !description?.trim()) {
      return c.json({ error: "mode and description are required" }, 400);
    }

    const system = `You are an archetype classifier for a product wizard.

The user selected "${mode}" mode, but they may have picked the wrong one. Your job is to find the BEST matching archetype across ALL modes, then tell us if the mode should change.

1. Classify into the TOP 3 most likely archetypes from ALL modes below.
2. Assign confidence scores (0.0 to 1.0). They must sum to <= 1.0.
3. If the best archetype belongs to a DIFFERENT mode than "${mode}", set "suggested_mode" to the correct mode.
4. If the highest confidence is < 0.45, also provide a disambiguation question with 3-4 behavioral choice options.

Website archetypes:
- website.brand.v1: Brand / Marketing Site — company presence, credibility, services showcase
- website.leadgen.v1: Lead Generation — multi-page site focused on conversions, forms, CTAs
- website.landing.v1: Landing Page — single-page, one goal, one CTA
- website.ecommerce.v1: E-commerce — product catalog, cart, checkout
- website.content.v1: Content / Blog — articles, taxonomy, publishing workflow

Application archetypes:
- app.tracker.v1: Tracker — fitness, habits, logging, metrics tracking, TODO lists
- app.saas.v1: SaaS Dashboard — B2B admin panels, reports, roles, analytics
- app.marketplace.v1: Marketplace — two-sided platform, listings, payments, trust
- app.social.v1: Social — profiles, feed, messaging, interactions
- app.scheduling.v1: Scheduling — bookings, calendar, availability, reminders

Venture archetypes:
- venture.mvp.v1: MVP Builder — ship fast, minimal scope, validate core hypothesis
- venture.validation.v1: Market Validation — customer discovery, experiments, landing tests
- venture.gtm.v1: Go to Market — positioning, channels, pricing, sales motion
- venture.fundraising.v1: Fundraising — deck, narrative, metrics, investor pipeline
- venture.company.v1: Company Setup — org structure, hiring plan, OKRs, operations

Also assess how detailed the user's description is:
- "minimal": 1-2 vague sentences, missing key info (audience, features, goals)
- "moderate": clear idea with some specifics but gaps remain
- "comprehensive": rich detail covering audience, features, goals, constraints

Return ONLY valid JSON:
{
  "archetypes": [
    { "id": "...", "title": "...", "confidence": 0.XX, "description": "one sentence why this matches" }
  ],
  "suggested_mode": "website|application|venture (only if different from selected mode, otherwise omit)",
  "disambiguation": { "question": "...", "options": ["...", "...", "..."] },
  "detail_level": "minimal|moderate|comprehensive"
}`;

    try {
      const { text, inputTokens, outputTokens } = await callLLM("haiku", system,description.trim());
      const parsed = parseJSON(text);
      const cost = computeCost("haiku", inputTokens, outputTokens);

      recordChatSpend(getRoot(), {
        timestamp: new Date().toISOString(),
        model: "haiku",
        inputTokens,
        outputTokens,
        cost,
        phase: "discovery",
      });

      return c.json({
        archetypes: parsed.archetypes || [],
        suggested_mode: parsed.suggested_mode || null,
        disambiguation: parsed.disambiguation || null,
        detail_level: parsed.detail_level || "minimal",
        model: MODEL_IDS.haiku,
        cost,
      });
    } catch (err: any) {
      return c.json({ error: err.message || "Classification failed" }, 500);
    }
  });

  // ── POST /wizard/expand ──
  router.post("/wizard/expand", async (c) => {
    const body = await c.req.json<{ description: string; mode: string }>();
    const { description, mode } = body;

    if (!description?.trim()) {
      return c.json({ error: "description is required" }, 400);
    }

    const system = `You are a product brief expander. The user is building a ${mode || "product"}.
They wrote a short prompt. Expand it into a structured product brief.

Rules:
- Keep the user's original intent exactly — do not change direction
- Sound like a founder explaining their idea with clarity and confidence
- Do NOT add technical stack, pricing, or implementation details
- Return ONLY valid JSON, no preamble, no markdown, no code fences

{
  "overview": "One compelling paragraph describing what this is and the core value proposition.",
  "audience": ["Who this is for (2-3 short entries)"],
  "features": ["Key capability 1 (4-6 short entries)"],
  "goal": "One sentence: what success looks like for this product."
}`;

    try {
      const { text, inputTokens, outputTokens } = await callLLM("opus", system, description.trim(), 600);
      const cost = computeCost("opus", inputTokens, outputTokens);

      recordChatSpend(getRoot(), {
        timestamp: new Date().toISOString(),
        model: "opus",
        inputTokens,
        outputTokens,
        cost,
        phase: "discovery",
      });

      let brief: { overview: string; audience: string[]; features: string[]; goal: string } | null = null;
      try { brief = parseJSON(text); } catch {}

      // Build plain text summary for downstream API calls (classify, personalize)
      const expanded = brief
        ? [brief.overview, brief.audience?.join(". "), brief.features?.join(". "), brief.goal].filter(Boolean).join(" ")
        : text.trim();

      return c.json({ expanded, brief, cost });
    } catch (err: any) {
      return c.json({ error: err.message || "Expansion failed" }, 500);
    }
  });

  // ── POST /wizard/clarify ──
  router.post("/wizard/clarify", async (c) => {
    const body = await c.req.json<{
      description: string;
      archetypeId: string;
      detailLevel?: string;
      previousAnswers?: Record<string, any>;
    }>();

    const { description, archetypeId, detailLevel, previousAnswers } = body;

    if (!description?.trim()) {
      return c.json({ error: "description is required" }, 400);
    }
    if (!archetypeId) {
      return c.json({ error: "archetypeId is required" }, 400);
    }

    const system = `You are a product discovery interviewer.

The user gave a brief description and selected archetype "${archetypeId}".
Your job is to ask the missing questions that materially affect the product scope, UX, and visual direction.

Rules:
- Ask ONLY the most important gaps; no generic or redundant questions.
- For detail level:
  - minimal: ask 3-5 questions
  - moderate: ask 2-3 questions
  - comprehensive: ask 0-1 questions (or return empty array)
- Questions must be concrete and domain-specific.
- Use "multiselect" for category/type questions.
- Do NOT include catch-all options like "Mix", "All of the above", "Various", "Combination".
- Always include at least ONE design question unless it is already clearly answered.
- Design questions should cover: visual style/feel, layout density, or imagery (photos vs illustration vs video).
- IDs must be stable: clarify_1, clarify_2, clarify_3...

Example (for "recipe website"):
- What type of recipes (cooking vs baking)?
- Cuisine focus (Italian, Mediterranean, etc.)?
- Dietary focus (vegan, keto, gluten-free)?
- Media format (step-by-step photos, video)?
 - What visual feel should it have? (clean/minimal vs cozy/editorial)

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": "clarify_1",
      "type": "select|multiselect|short_text",
      "prompt": "question text",
      "options": ["option 1", "option 2"],
      "default": null,
      "required": true
    }
  ]
}`;

    const userMsg = `User description: "${description.trim()}"
Detail level: ${detailLevel || "minimal"}
Previous answers: ${JSON.stringify(previousAnswers || {})}`;

    try {
      const { text, inputTokens, outputTokens } = await callLLM("haiku", system, userMsg, 900);
      const parsed = parseJSON(text);
      const cost = computeCost("haiku", inputTokens, outputTokens);

      recordChatSpend(getRoot(), {
        timestamp: new Date().toISOString(),
        model: "haiku",
        inputTokens,
        outputTokens,
        cost,
        phase: "discovery",
      });

      const CATCHALL = /^(mix of|all of the above|combination|multiple|various|hybrid|any|whatever)/i;
      const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
      const detail = detailLevel || "minimal";
      const maxQuestions = detail === "comprehensive" ? 1 : detail === "moderate" ? 3 : 5;
      const minQuestions = detail === "comprehensive" ? 0 : detail === "moderate" ? 2 : 3;

      const cleaned = rawQuestions.map((q: any, idx: number) => {
        const options = Array.isArray(q.options) ? q.options.filter((o: string) => !CATCHALL.test(o.trim())) : undefined;
        return {
          id: q.id || `clarify_${idx + 1}`,
          type: q.type || "select",
          prompt: q.prompt || "Clarify requirement",
          options,
          default: q.default ?? null,
          required: q.required !== false,
        };
      });

      const hasDesign = cleaned.some((q: any) =>
        /design|visual|look|feel|style|layout|typography|color|imagery|photos|illustration|video/i.test(q.prompt || "")
      );

      const fallbackDesignQuestions = [
        {
          id: "clarify_design_feel",
          type: "select",
          prompt: "What visual feel should it have?",
          options: ["Clean and minimal", "Warm and cozy", "Editorial and elegant", "Bold and modern"],
          default: null,
          required: true,
        },
        {
          id: "clarify_layout_density",
          type: "select",
          prompt: "How dense should the layout be?",
          options: ["Spacious and airy", "Balanced", "Information-dense"],
          default: null,
          required: true,
        },
      ];

      let questions = cleaned;
      if (!hasDesign && questions.length < maxQuestions) {
        questions = [...questions, fallbackDesignQuestions[0]];
      }
      if (!hasDesign && detail === "minimal" && questions.length < maxQuestions) {
        questions = [...questions, fallbackDesignQuestions[1]];
      }

      // Enforce min/max and stable IDs
      if (questions.length < minQuestions) {
        const needed = Math.min(fallbackDesignQuestions.length, minQuestions - questions.length);
        for (let i = 0; i < needed; i++) {
          if (!questions.find((q: any) => q.id === fallbackDesignQuestions[i].id)) {
            questions.push(fallbackDesignQuestions[i]);
          }
        }
      }

      questions = questions.slice(0, maxQuestions).map((q: any, idx: number) => ({
        ...q,
        id: `clarify_${idx + 1}`,
      }));

      return c.json({
        questions,
        model: MODEL_IDS.haiku,
        cost,
      });
    } catch (err: any) {
      return c.json({ error: err.message || "Clarification failed" }, 500);
    }
  });

  // ── POST /wizard/personalize ──
  router.post("/wizard/personalize", async (c) => {
    const body = await c.req.json<{
      archetypeId: string;
      stepId: string;
      step: { title: string; questions: any[] };
      userDescription: string;
      previousAnswers: Record<string, any>;
      detailLevel?: string;
    }>();

    const { archetypeId, stepId, step, userDescription, previousAnswers, detailLevel } = body;

    if (!archetypeId || !stepId || !step?.questions) {
      return c.json({ error: "archetypeId, stepId, and step are required" }, 400);
    }

    const questionBudget = detailLevel === "comprehensive" ? "1-2" : detailLevel === "moderate" ? "2-3" : "all";

    const system = `You personalize wizard questions for a product builder.

The user is building: "${userDescription}"
Archetype: ${archetypeId}
Current step: "${step.title}" (id: ${stepId})
${Object.keys(previousAnswers || {}).length > 0 ? `Previous answers: ${JSON.stringify(previousAnswers)}` : ""}

Detail level of the user's description: ${detailLevel || "minimal"}
Question budget: return only ${questionBudget} of the most important questions.

CRITICAL:
- If detail level is "minimal", DO NOT mark any question as skipped. Ask all base questions even if you think you can infer the answer.
- If detail level is "moderate", skip at most 1 question.
- If detail level is "comprehensive", you may skip more.

You receive the base questions for this step. Your job:
1. Rewrite question wording to match the user's specific context (e.g., if they said "fitness app", make questions fitness-specific).
2. Adapt option labels to be more relevant to their description.
3. Infer sensible defaults from the description where possible.
4. You MAY change the question type. Keep the same question IDs. Do NOT add or remove questions — but mark inferred ones as skipped.
5. CRITICAL: When a question asks about categories, types, or features — change its type to "multiselect". Remove ANY catch-all option like "Mix of types", "Mix of X", "All of the above", "Combination", "Multiple", "Various", "Hybrid". The user can multi-select specific options instead. If the base question has such an option, DELETE it from the options array.

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": "original_id",
      "type": "select|multiselect|short_text",
      "prompt": "personalized question text",
      "options": ["adapted", "options", "here"],
      "default": "inferred default or null",
      "required": true,
      "skipped": false
    }
  ]
}`;

    const userMsg = `Base questions for step "${step.title}":\n${JSON.stringify(step.questions, null, 2)}`;

    try {
      const { text, inputTokens, outputTokens } = await callLLM("haiku", system,userMsg);
      const parsed = parseJSON(text);
      const cost = computeCost("haiku", inputTokens, outputTokens);

      recordChatSpend(getRoot(), {
        timestamp: new Date().toISOString(),
        model: "haiku",
        inputTokens,
        outputTokens,
        cost,
        phase: "discovery",
      });

      // Strip catch-all options the LLM may have kept
      const CATCHALL = /^(mix of|all of the above|combination|multiple|various|hybrid)/i;
      const questions = (parsed.questions || step.questions).map((q: any) => {
        if (q.options) {
          q.options = q.options.filter((o: string) => !CATCHALL.test(o.trim()));
        }
        return q;
      });

      return c.json({
        questions,
        model: MODEL_IDS.haiku,
        cost,
      });
    } catch (err: any) {
      // Fallback: return original questions unpersonalized
      return c.json({
        questions: step.questions.map((q: any) => ({ ...q, default: null, required: q.required ?? true })),
        model: "fallback",
        cost: 0,
        fallback: true,
        error: err.message,
      });
    }
  });

  return router;
}
