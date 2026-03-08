/**
 * Wizard routes — archetype classification and question personalization.
 * Part of the Kadima API.
 *
 * Handles:
 *   POST /api/wizard/classify        — classify description into archetypes
 *   POST /api/wizard/classifyRetry   — same (backward compat alias)
 *   POST /api/wizard/expand          — expand short description into structured brief
 *   POST /api/wizard/clarify         — generate clarification questions
 *   POST /api/wizard/palette         — generate brand color palettes
 *   POST /api/wizard/personalize     — personalize step questions
 */

import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_DIR = resolve(__dirname, '..', '..', 'ogu', 'commands', 'lib');

const MODEL_IDS = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus:   'claude-opus-4-6',
};

const PRICES = {
  haiku:  { input: 0.80,  output: 4.00  },
  sonnet: { input: 3.00,  output: 15.00 },
  opus:   { input: 15.00, output: 75.00 },
};

const LANG_RULE = '\n\nIMPORTANT: Always respond in English regardless of the user\'s language.';

// ── Shared helpers (exported for brief-routes) ────────────────────────────────

export function computeCost(model, inputTokens, outputTokens) {
  const p = PRICES[model] || PRICES.sonnet;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export async function recordChatSpend(root, entry) {
  try {
    const { getBudgetDir } = await import(`${LIB_DIR}/runtime-paths.mjs`);
    const budgetDir = getBudgetDir(root);
    mkdirSync(budgetDir, { recursive: true });
    appendFileSync(join(budgetDir, 'chat-spend.jsonl'), JSON.stringify(entry) + '\n', 'utf8');
  } catch { /* best-effort */ }
}

export async function callLLM(model, system, userMessage, maxTokens = 1024) {
  const modelId = MODEL_IDS[model] || MODEL_IDS.sonnet;
  const fullSystem = system + LANG_RULE;

  const raw = await new Promise((resolve_, reject) => {
    const args = [
      '-p', userMessage,
      '--system', fullSystem,
      '--model', modelId,
      '--max-tokens', String(maxTokens),
      '--output-format', 'json',
    ];
    const proc = spawn('claude', args);
    const chunks = [];
    const errChunks = [];
    proc.stdout.on('data', (chunk) => chunks.push(chunk));
    proc.stderr.on('data', (chunk) => errChunks.push(chunk));
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude CLI exited ${code}: ${Buffer.concat(errChunks).toString()}`));
      } else {
        resolve_(Buffer.concat(chunks).toString('utf8'));
      }
    });
    proc.on('error', reject);
  });

  const cliData = JSON.parse(raw);
  return {
    text:         cliData.result ?? cliData.text ?? '',
    inputTokens:  cliData.usage?.input_tokens  || 0,
    outputTokens: cliData.usage?.output_tokens || 0,
  };
}

function repairJSON(text) {
  const stack = [];
  let inString = false;
  let escape = false;

  for (const ch of text) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  let repaired = text;
  if (inString) repaired += '"';
  repaired = repaired.replace(/,\s*$/, '');
  repaired += stack.reverse().join('');
  return repaired;
}

export function parseJSON(text) {
  try { return JSON.parse(text); } catch {}

  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }

  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const slice = text.slice(start, end + 1);
    try { return JSON.parse(slice); } catch {}
    try { return JSON.parse(repairJSON(slice)); } catch {}
  }

  if (start >= 0) {
    try { return JSON.parse(repairJSON(text.slice(start))); } catch {}
  }

  throw new Error('Failed to parse LLM response as JSON');
}

function normalizeHex(color) {
  if (!color || typeof color !== 'string') return null;
  let c = color.trim();
  if (!c.startsWith('#')) c = `#${c}`;
  if (/^#([0-9a-fA-F]{3})$/.test(c)) {
    const m = c.slice(1);
    c = `#${m[0]}${m[0]}${m[1]}${m[1]}${m[2]}${m[2]}`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(c)) return null;
  return c.toUpperCase();
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function handleWizardRoutes(url, method, readBody, res, root, broadcaster, json) {
  if (method !== 'POST') return false;
  const path = url.pathname;

  // POST /api/wizard/classify  +  POST /api/wizard/classifyRetry
  if (path === '/api/wizard/classify' || path === '/api/wizard/classifyRetry') {
    const body = await readBody();
    const { mode, description } = body;

    if (!mode || !description?.trim()) {
      json(res, 400, { error: 'mode and description are required' });
      return true;
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
      const { text, inputTokens, outputTokens } = await callLLM('haiku', system, description.trim());
      const parsed = parseJSON(text);
      const cost = computeCost('haiku', inputTokens, outputTokens);
      await recordChatSpend(root, { timestamp: new Date().toISOString(), model: 'haiku', inputTokens, outputTokens, cost, phase: 'discovery' });

      json(res, 200, {
        archetypes:      parsed.archetypes     || [],
        suggested_mode:  parsed.suggested_mode || null,
        disambiguation:  parsed.disambiguation || null,
        detail_level:    parsed.detail_level   || 'minimal',
        model: MODEL_IDS.haiku,
        cost,
      });
    } catch (err) {
      json(res, 500, { error: err.message || 'Classification failed' });
    }
    return true;
  }

  // POST /api/wizard/expand
  if (path === '/api/wizard/expand') {
    const body = await readBody();
    const { description, mode } = body;
    if (!description?.trim()) { json(res, 400, { error: 'description is required' }); return true; }

    const system = `You are a product brief expander. The user is building a ${mode || 'product'}.
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
      const { text, inputTokens, outputTokens } = await callLLM('opus', system, description.trim(), 600);
      const cost = computeCost('opus', inputTokens, outputTokens);
      await recordChatSpend(root, { timestamp: new Date().toISOString(), model: 'opus', inputTokens, outputTokens, cost, phase: 'discovery' });

      let brief = null;
      try { brief = parseJSON(text); } catch {}

      const expanded = brief
        ? [brief.overview, brief.audience?.join('. '), brief.features?.join('. '), brief.goal].filter(Boolean).join(' ')
        : text.trim();

      json(res, 200, { expanded, brief, cost });
    } catch (err) {
      json(res, 500, { error: err.message || 'Expansion failed' });
    }
    return true;
  }

  // POST /api/wizard/clarify
  if (path === '/api/wizard/clarify') {
    const body = await readBody();
    const { description, archetypeId, detailLevel, previousAnswers } = body;
    if (!description?.trim()) { json(res, 400, { error: 'description is required' }); return true; }
    if (!archetypeId)         { json(res, 400, { error: 'archetypeId is required' }); return true; }

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
- If the description is vague, always include at least ONE question that narrows the product's primary focus.
- Use "multiselect" for category/type questions.
- Do NOT include catch-all options like "Mix", "All of the above", "Various", "Combination".
- Always include at least ONE design question unless it is already clearly answered.
- IDs must be stable: clarify_1, clarify_2, clarify_3...

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
Detail level: ${detailLevel || 'minimal'}
Previous answers: ${JSON.stringify(previousAnswers || {})}`;

    try {
      const { text, inputTokens, outputTokens } = await callLLM('haiku', system, userMsg, 900);
      const parsed = parseJSON(text);
      const cost = computeCost('haiku', inputTokens, outputTokens);
      await recordChatSpend(root, { timestamp: new Date().toISOString(), model: 'haiku', inputTokens, outputTokens, cost, phase: 'discovery' });

      const CATCHALL = /^(mix of|all of the above|combination|multiple|various|hybrid|any|whatever)/i;
      const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
      const detail = detailLevel || 'minimal';
      const maxQuestions = detail === 'comprehensive' ? 3 : detail === 'moderate' ? 5 : 6;
      const minQuestions = detail === 'comprehensive' ? 3 : detail === 'moderate' ? 3 : 4;

      const cleaned = rawQuestions.map((q, idx) => {
        const options = Array.isArray(q.options) ? q.options.filter((o) => !CATCHALL.test(o.trim())) : undefined;
        return { id: q.id || `clarify_${idx + 1}`, type: q.type || 'select', prompt: q.prompt || 'Clarify requirement', options, default: q.default ?? null, required: q.required !== false };
      });

      const hasDesign = cleaned.some((q) => /design|visual|look|feel|style|layout|typography|color|imagery|photos|illustration|video/i.test(q.prompt || ''));
      const hasFocus  = cleaned.some((q) => /type|category|categories|focus|topic|cuisine|product|service|marketplace|track|schedule/i.test(q.prompt || ''));

      const desc = (description || '').toLowerCase();
      const prevText = JSON.stringify(previousAnswers || {}).toLowerCase();
      const hasLanguage = /language|lang|hebrew|עברית|english|arabic|rtl|ltr/i.test(desc) || /language|lang|hebrew|עברית|english|arabic|rtl|ltr/i.test(prevText) || cleaned.some((q) => /language|lang|rtl|ltr/i.test(q.prompt || ''));
      const hasFont = /font|typography|typeface/i.test(desc) || /font|typography|typeface/i.test(prevText) || cleaned.some((q) => /font|typography|typeface/i.test(q.prompt || ''));

      const mandatoryQuestions = [
        !hasLanguage && { id: 'clarify_language', type: 'select', prompt: 'What language should the site be built in?', options: ['Hebrew (RTL)', 'English', 'Arabic (RTL)', 'Hebrew + English', 'Arabic + English'], default: null, required: true },
        !hasFont && { id: 'clarify_font_style', type: 'select', prompt: 'What primary font style should lead the design?', options: ['Modern sans (clean)', 'Classic serif (editorial)', 'Geometric sans (bold)', 'Humanist sans (warm)', 'Display (distinctive)'], default: null, required: true },
      ].filter(Boolean);

      const fallbackDesignQuestions = [
        { id: 'clarify_design_feel', type: 'select', prompt: 'What visual feel should it have?', options: ['Clean and minimal', 'Warm and cozy', 'Editorial and elegant', 'Bold and modern'], default: null, required: true },
        { id: 'clarify_layout_density', type: 'select', prompt: 'How dense should the layout be?', options: ['Spacious and airy', 'Balanced', 'Information-dense'], default: null, required: true },
      ];

      const focusByArchetype = {
        'website.content.v1':   { id: 'clarify_content_focus',     type: 'short_text', prompt: 'Which content categories or topics should it focus on?', default: null, required: true },
        'website.ecommerce.v1': { id: 'clarify_product_focus',     type: 'short_text', prompt: 'What product categories are you selling?', default: null, required: true },
        'app.marketplace.v1':   { id: 'clarify_marketplace_focus', type: 'short_text', prompt: 'What is being listed or exchanged in the marketplace?', default: null, required: true },
        'app.tracker.v1':       { id: 'clarify_tracker_focus',     type: 'short_text', prompt: 'What exactly should the product track?', default: null, required: true },
        'app.scheduling.v1':    { id: 'clarify_scheduling_focus',  type: 'short_text', prompt: 'What is being scheduled or booked?', default: null, required: true },
      };

      let questions = cleaned;
      const focusFallback = focusByArchetype[archetypeId];
      if (!hasFocus && focusFallback && questions.length < maxQuestions) questions = [...questions, focusFallback];
      if (!hasDesign && questions.length < maxQuestions) questions = [...questions, fallbackDesignQuestions[0]];
      if (!hasDesign && detail === 'minimal' && questions.length < maxQuestions) questions = [...questions, fallbackDesignQuestions[1]];

      if (mandatoryQuestions.length > 0) {
        const seenPrompts = new Set(questions.map((q) => (q.prompt || '').toLowerCase()));
        const prepended = mandatoryQuestions.filter((q) => !seenPrompts.has((q.prompt || '').toLowerCase()));
        questions = [...prepended, ...questions];
      }

      if (questions.length < minQuestions) {
        const needed = Math.min(fallbackDesignQuestions.length, minQuestions - questions.length);
        for (let i = 0; i < needed; i++) {
          if (!questions.find((q) => q.id === fallbackDesignQuestions[i].id)) questions.push(fallbackDesignQuestions[i]);
        }
      }

      questions = questions.slice(0, maxQuestions).map((q, idx) => ({ ...q, id: `clarify_${idx + 1}` }));

      json(res, 200, { questions, model: MODEL_IDS.haiku, cost });
    } catch (err) {
      json(res, 500, { error: err.message || 'Clarification failed' });
    }
    return true;
  }

  // POST /api/wizard/palette
  if (path === '/api/wizard/palette') {
    const body = await readBody();
    const { description, archetypeId, detailLevel, previousAnswers } = body;
    if (!description?.trim()) { json(res, 400, { error: 'description is required' }); return true; }

    const system = `You are a brand color palette generator for product websites.

Generate 4 distinct palettes that fit the product and audience.
Rules:
- Each palette must include 4–6 HEX colors (#RRGGBB)
- Colors should be usable for UI: include background, primary, accent, text
- Keep names short and evocative
- Provide a 1-sentence rationale
- Return ONLY valid JSON

{
  "palettes": [
    { "name": "Warm Sesame", "colors": ["#F3E2C7", "#D8B48A", "#B5794A", "#3C2E25", "#FFFFFF"], "notes": "..." }
  ]
}`;

    const userMsg = `Product: ${description.trim()}
Archetype: ${archetypeId || 'unknown'}
Detail level: ${detailLevel || 'minimal'}
Previous answers: ${JSON.stringify(previousAnswers || {})}`;

    const fallbackPalettes = [
      { name: 'Warm Sesame',       colors: ['#F5E6CC', '#D9B98C', '#B77A4A', '#4B3621', '#FFFFFF'], notes: 'Earthy warmth and comfort.' },
      { name: 'Fresh Green',       colors: ['#F2F7F2', '#B8E0C9', '#5FB47A', '#1F4D36', '#0F1F17'], notes: 'Clean, fresh, and modern.' },
      { name: 'Mediterranean Blue', colors: ['#F2F6FA', '#A8C7E6', '#2E6AA5', '#0F2A3A', '#FFFFFF'], notes: 'Coastal clarity with strong contrast.' },
      { name: 'Bold Contrast',     colors: ['#F7F1E8', '#E07A5F', '#3D405B', '#1B1D2A', '#FFFFFF'], notes: 'High contrast with a premium edge.' },
    ];

    try {
      const { text, inputTokens, outputTokens } = await callLLM('haiku', system, userMsg, 900);
      const parsed = parseJSON(text);
      const cost = computeCost('haiku', inputTokens, outputTokens);
      await recordChatSpend(root, { timestamp: new Date().toISOString(), model: 'haiku', inputTokens, outputTokens, cost, phase: 'discovery' });

      const raw = Array.isArray(parsed?.palettes) ? parsed.palettes : [];
      const palettes = raw.map((p, idx) => {
        const colors = Array.isArray(p?.colors) ? p.colors.map(normalizeHex).filter(Boolean) : [];
        if (colors.length < 3) return null;
        return {
          id:     `palette_${idx + 1}`,
          name:   (p?.name || `Palette ${idx + 1}`).toString().slice(0, 40),
          colors: colors.slice(0, 6),
          notes:  (p?.notes || p?.rationale || '').toString().slice(0, 120),
        };
      }).filter(Boolean);

      json(res, 200, { palettes: palettes.length > 0 ? palettes : fallbackPalettes, model: MODEL_IDS.haiku, cost });
    } catch (err) {
      json(res, 200, { palettes: fallbackPalettes, model: 'fallback', cost: 0, error: err.message });
    }
    return true;
  }

  // POST /api/wizard/personalize
  if (path === '/api/wizard/personalize') {
    const body = await readBody();
    const { archetypeId, stepId, step, userDescription, previousAnswers, detailLevel } = body;

    if (!archetypeId || !stepId || !step?.questions) {
      json(res, 400, { error: 'archetypeId, stepId, and step are required' });
      return true;
    }

    const questionBudget = detailLevel === 'comprehensive' ? '1-2' : detailLevel === 'moderate' ? '2-3' : 'all';

    const system = `You personalize wizard questions for a product builder.

The user is building: "${userDescription}"
Archetype: ${archetypeId}
Current step: "${step.title}" (id: ${stepId})
${Object.keys(previousAnswers || {}).length > 0 ? `Previous answers: ${JSON.stringify(previousAnswers)}` : ''}

Detail level of the user's description: ${detailLevel || 'minimal'}
Question budget: return only ${questionBudget} of the most important questions.

CRITICAL:
- If detail level is "minimal", DO NOT mark any question as skipped. Ask all base questions.
- If detail level is "moderate", skip at most 1 question.
- If detail level is "comprehensive", you may skip more.

You receive the base questions for this step. Your job:
1. Rewrite question wording to match the user's specific context.
2. Adapt option labels to be more relevant.
3. Infer sensible defaults from the description where possible.
4. You MAY change the question type. Keep the same question IDs. Do NOT add or remove questions — but mark inferred ones as skipped.
5. CRITICAL: When a question asks about categories, types, or features — change its type to "multiselect". Remove ANY catch-all option like "Mix of types", "All of the above", "Combination", "Multiple", "Various", "Hybrid".

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
      const { text, inputTokens, outputTokens } = await callLLM('haiku', system, userMsg);
      const parsed = parseJSON(text);
      const cost = computeCost('haiku', inputTokens, outputTokens);
      await recordChatSpend(root, { timestamp: new Date().toISOString(), model: 'haiku', inputTokens, outputTokens, cost, phase: 'discovery' });

      const CATCHALL = /^(mix of|all of the above|combination|multiple|various|hybrid)/i;
      const questions = (parsed.questions || step.questions).map((q) => {
        if (q.options) q.options = q.options.filter((o) => !CATCHALL.test(o.trim()));
        return q;
      });

      json(res, 200, { questions, model: MODEL_IDS.haiku, cost });
    } catch (err) {
      json(res, 200, {
        questions: step.questions.map((q) => ({ ...q, default: null, required: q.required ?? true })),
        model: 'fallback',
        cost: 0,
        fallback: true,
        error: err.message,
      });
    }
    return true;
  }

  // ── POST /api/wizard/research ─────────────────────────────────────────────
  // SSE stream. Runs the 5-step Researcher Agent and emits progress events.
  // Events: research:progress, research:complete, research:error
  if (url.pathname === '/api/wizard/research' && method === 'POST') {
    const body = await readBody();
    const { description, mode, slug: candidateSlug = '' } = body || {};

    if (!description?.trim() || !mode) {
      json(res, 400, { error: 'description and mode are required' });
      return true;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = (event, data) => {
      try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* client disconnected */ }
    };

    (async () => {
      try {
        const { runResearch } = await import('./researcher.mjs');
        const onProgress = async (step, stepId, stepIndex, done) => {
          send('research:progress', { step, step_id: stepId, step_index: stepIndex, total_steps: 5, done });
        };
        const report = await runResearch(description.trim(), mode, candidateSlug, onProgress);
        send('research:complete', { report });
      } catch (err) {
        send('research:error', { error: err?.message || 'Research failed' });
      } finally {
        try { res.end(); } catch { /* already ended */ }
      }
    })();

    return true;
  }

  return false;
}
