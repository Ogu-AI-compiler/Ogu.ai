/**
 * Researcher — Kadima API module.
 * Part of the Kadima API.
 *
 * Provides:
 *   runResearch(description, mode, candidateSlug, onProgress) → ResearchReport
 *   loadReportFromStaging(slug) → ResearchReport | null
 *
 * LLM calls use the claude CLI directly via execFileSync / spawn.
 * Web search uses claude CLI with --allowedTools web_search.
 * Reports are saved to ~/.ogu/research-staging/{slug}.json.
 *
 * Timeout: 240_000ms (4 minutes).
 *
 * ─── DEPLOY NOTE ─────────────────────────────────────────────────────────────
 * Currently uses `claude` CLI + --allowedTools web_search (no API key needed).
 * Before deployment, switch to Anthropic API + web_search tool:
 *   tools: [{ type: "web_search_20250305", name: "web_search" }]
 * Set ANTHROPIC_API_KEY env var — replace callWebSearchAsync() accordingly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ── Constants ──────────────────────────────────────────────────────────────

const MODEL_IDS = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
};

const TOTAL_TIMEOUT_MS = 240_000; // 4 minutes
const LANG_RULE = "\n\nIMPORTANT: Always respond in English regardless of the user's language.";
const STAGING_DIR = join(homedir(), '.ogu', 'research-staging');

// ── JSON parsing / repair ──────────────────────────────────────────────────

function parseJSON(text) {
  if (!text || typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch {}

  const md = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (md) { try { return JSON.parse(md[1].trim()); } catch {} }

  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s !== -1 && e !== -1 && e > s) {
    try { return JSON.parse(text.slice(s, e + 1)); } catch {}
    try { return JSON.parse(repairJSON(text.slice(s, e + 1))); } catch {}
  }
  if (s !== -1) { try { return JSON.parse(repairJSON(text.slice(s))); } catch {} }
  return null;
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

// ── LLM helpers ───────────────────────────────────────────────────────────

function callLLMSync(model, system, userMessage, maxTokens = 1000) {
  const modelId = MODEL_IDS[model];
  const fullSystem = system + LANG_RULE;

  let raw;
  try {
    raw = execFileSync(
      'claude',
      [
        '-p', userMessage,
        '--system', fullSystem,
        '--model', modelId,
        '--max-tokens', String(maxTokens),
        '--output-format', 'json',
      ],
      { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024, timeout: 120_000, env: { ...process.env, CLAUDECODE: undefined } }
    );
  } catch (err) {
    throw new Error(`claude CLI failed (${model}): ${err.message}`);
  }

  const parsed = JSON.parse(raw);
  return parsed.result ?? parsed.text ?? parsed.content ?? '';
}

async function callWebSearchAsync(searchPrompt) {
  return new Promise((resolve) => {
    const spawnEnv = { ...process.env };
    delete spawnEnv.CLAUDECODE;
    const proc = spawn('claude', [
      '-p', searchPrompt,
      '--allowedTools', 'web_search',
      '--output-format', 'json',
      '--max-tokens', '2000',
    ], { env: spawnEnv });

    const chunks = [];
    proc.stdout.on('data', (chunk) => chunks.push(chunk));

    const timeout = setTimeout(() => {
      proc.kill();
      try {
        const fallback = callLLMSync(
          'sonnet',
          'You are a research assistant. Answer based on your training knowledge. Be specific and factual.',
          searchPrompt,
          1500
        );
        resolve({ text: fallback, source: 'llm_knowledge' });
      } catch {
        resolve({ text: `Search timed out for: ${searchPrompt}`, source: 'error' });
      }
    }, 60_000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        try {
          const fallback = callLLMSync(
            'sonnet',
            'You are a research assistant. Answer based on your training knowledge. Be specific and factual.',
            searchPrompt,
            1500
          );
          resolve({ text: fallback, source: 'llm_knowledge' });
        } catch (fallbackErr) {
          resolve({ text: `Search failed and fallback failed: ${fallbackErr.message}`, source: 'error' });
        }
        return;
      }
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const parsed = JSON.parse(raw);
        const text = parsed.result ?? parsed.text ?? parsed.content ?? '';
        resolve({ text, source: 'web_search' });
      } catch {
        resolve({ text: 'Failed to parse search result', source: 'error' });
      }
    });

    proc.on('error', () => {
      clearTimeout(timeout);
      try {
        const fallback = callLLMSync(
          'sonnet',
          'You are a research assistant. Answer based on your training knowledge. Be specific and factual.',
          searchPrompt,
          1500
        );
        resolve({ text: fallback, source: 'llm_knowledge' });
      } catch {
        resolve({ text: `Spawn error for: ${searchPrompt}`, source: 'error' });
      }
    });
  });
}

// ── Step 1: Infer Search Plan ─────────────────────────────────────────────

async function inferSearchPlan(description, mode) {
  const system = `You are a research planner for product analysis. Given a product idea and mode, you determine:
- What kind of entity this is (entity_type)
- The product name if discernible (entity_name, or null)
- The user's core goals (user_goals: 2-4 strings)
- 4-6 specific search queries to gather market/competitor/technical/design intel
- A rationale for your search strategy

Mode meanings:
- app: web or mobile application
- site: marketing/content website
- feature: a specific product feature addition
- startup: early-stage startup/venture idea

Return ONLY valid JSON, no preamble:
{
  "entity_type": "SaaS product | mobile app | marketing site | ...",
  "entity_name": "ProductName or null",
  "user_goals": ["goal1", "goal2"],
  "queries": ["query1", "query2", "query3", "query4"],
  "rationale": "brief explanation of search strategy"
}`;

  const userMsg = `Product description: "${description}"\nMode: ${mode}`;
  const text = callLLMSync('haiku', system, userMsg, 800);
  const parsed = parseJSON(text);

  if (!parsed) {
    return {
      entity_type: mode === 'app' ? 'application' : mode === 'site' ? 'website' : mode === 'startup' ? 'startup' : 'product',
      entity_name: null,
      user_goals: ['Build a successful product', 'Serve target users well'],
      queries: [
        `${description} competitors analysis`,
        `${description} market size trends`,
        `${description} technical implementation best practices`,
        `${description} design inspiration examples`,
      ],
      rationale: 'Default search plan due to inference failure.',
    };
  }

  return {
    entity_type: parsed.entity_type || 'product',
    entity_name: parsed.entity_name ?? null,
    user_goals: Array.isArray(parsed.user_goals) ? parsed.user_goals : [],
    queries: Array.isArray(parsed.queries) ? parsed.queries.slice(0, 6) : [],
    rationale: parsed.rationale || '',
  };
}

// ── Step 2: Execute Searches ──────────────────────────────────────────────

async function executeSearches(queries) {
  return Promise.all(
    queries.map(async (query) => {
      const result = await callWebSearchAsync(query);
      return { query, text: result.text, source: result.source };
    })
  );
}

// ── Step 3: Cross-Validate ────────────────────────────────────────────────

function crossValidate(results) {
  const allText = results.map((r) => r.text).join('\n');

  const wordFreq = {};
  const significantWords = allText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4);

  for (const w of significantWords) {
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  }

  const topWords = Object.entries(wordFreq)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);

  const conflicts = [];
  const hasPositive = /growing|increasing|popular|dominant|leading/i.test(allText);
  const hasNegative = /declining|saturated|dead|dying|failing/i.test(allText);
  if (hasPositive && hasNegative) {
    conflicts.push('Mixed signals on market momentum — some sources indicate growth, others decline.');
  }

  const gaps = results
    .filter((r) => r.source === 'error' || r.text.length < 100)
    .map((r) => `Missing data for: "${r.query}"`);

  const successRate = results.filter((r) => r.source !== 'error').length / Math.max(results.length, 1);
  const confidence = Math.min(0.95, 0.4 + successRate * 0.55);

  return {
    validated: topWords,
    conflicts,
    gaps,
    confidence,
    successfulSearches: results.filter((r) => r.source === 'web_search').length,
    fallbackSearches: results.filter((r) => r.source === 'llm_knowledge').length,
    failedSearches: results.filter((r) => r.source === 'error').length,
  };
}

// ── Step 4: Validate Assets ───────────────────────────────────────────────

async function validateAssets(assets) {
  if (!assets || assets.length === 0) return [];

  return Promise.all(
    assets.map(async (asset) => {
      if (!asset.url) return { ...asset, validated: false, reason: 'no_url' };
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(asset.url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'Ogu-Research-Bot/1.0' },
        });
        clearTimeout(timeout);
        if (!response.ok) return { ...asset, validated: false, reason: `http_${response.status}` };
        const contentType = response.headers.get('content-type') || '';
        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
        if (asset.type === 'image' && !contentType.includes('image')) {
          return { ...asset, validated: false, reason: 'wrong_content_type' };
        }
        if (contentLength > 5 * 1024 * 1024) return { ...asset, validated: false, reason: 'too_large' };
        return { ...asset, validated: true, contentType };
      } catch (err) {
        return { ...asset, validated: false, reason: err.name === 'AbortError' ? 'timeout' : 'fetch_error' };
      }
    })
  );
}

// ── Step 5: Synthesize Report ─────────────────────────────────────────────

async function synthesizeReport(searchResults, plan, mode, description) {
  const MAX_RESULT_CHARS = 400;
  const summarizedResults = searchResults.map((r) => ({
    query: r.query,
    excerpt: (r.text || '').slice(0, MAX_RESULT_CHARS).replace(/\n+/g, ' ').trim(),
    source: r.source,
  }));

  const planSummary = JSON.stringify({
    entity_type: plan.entity_type,
    entity_name: plan.entity_name,
    user_goals: plan.user_goals,
    rationale: plan.rationale,
  });

  const resultsText = summarizedResults
    .map((r, i) => `[${i + 1}] Query: "${r.query}"\nSource: ${r.source}\nExcerpt: ${r.excerpt}`)
    .join('\n\n');

  const techNote =
    mode === 'site' || mode === 'startup'
      ? 'Set tech_feasibility to null (not applicable for this mode).'
      : 'Populate tech_feasibility with build_complexity (low/medium/high), key_libraries (array of strings), known_pitfalls (array of strings), confidence (0-1).';

  const techShape =
    mode === 'site' || mode === 'startup'
      ? 'null'
      : '{ "build_complexity": "medium", "key_libraries": [], "known_pitfalls": [], "confidence": 0.7 }';

  const safeDescription = description.replace(/"/g, '\\"').slice(0, 200);

  const system = `You are a senior product research analyst. Synthesize the provided research data into a structured ResearchReport JSON.

${techNote}

IMPORTANT: Populate question_elimination_map with these EXACT keys (use null if unknown):
- clarify_language: the detected/inferred language (e.g. "en", "he", "ar")
- clarify_design_feel: inferred visual feel (e.g. "Clean and minimal", "Bold and modern")
- clarify_font_style: inferred font style (e.g. "Modern sans (clean)", "Classic serif (editorial)")
- clarify_visual_palette: dominant color theme inferred (e.g. "dark and professional", "warm and earthy")
- clarify_target_audience: who this is for (e.g. "B2B SaaS teams", "consumers aged 25-40")
- clarify_market_size: market size estimate (e.g. "$2B TAM", "niche", "mass market")

Return ONLY valid JSON matching this exact shape. No preamble, no markdown:
{
  "version": 1,
  "generated_at": "ISO_TIMESTAMP",
  "duration_ms": 0,
  "mode": "${mode}",
  "description": "${safeDescription}",
  "entity_type": "string",
  "entity_name": "string or null",
  "user_goals": ["goal1"],
  "search_plan": { "queries": [], "rationale": "" },
  "competitors": [{ "name": "", "url": "", "positioning": "", "strength": "", "weakness": "" }],
  "defensible_angle": { "open_angle": "", "rationale": "", "confidence": 0.8 },
  "tech_feasibility": ${techShape},
  "trend": { "momentum": "rising|stable|declining", "recent_events": [], "confidence": 0.6 },
  "assets": [{ "type": "color", "value": "#hex", "source": "", "validated": false }],
  "question_elimination_map": {
    "clarify_language": null,
    "clarify_design_feel": null,
    "clarify_font_style": null,
    "clarify_visual_palette": null,
    "clarify_target_audience": null,
    "clarify_market_size": null
  },
  "low_confidence_questions": [],
  "gaps": [],
  "confidence": { "entity": 0.9, "competitors": 0.8, "assets": 0.6, "tech": 0.7, "trends": 0.6 }
}`;

  const userMsg = `Intent inference:
${planSummary}

Search results (${summarizedResults.length} queries):
${resultsText}

Current timestamp: ${new Date().toISOString()}
Mode: ${mode}

Synthesize a complete ResearchReport JSON from this data.`;

  const text = callLLMSync('sonnet', system, userMsg, 2500);
  const parsed = parseJSON(text);
  if (!parsed) throw new Error('synthesizeReport: failed to parse Sonnet response as JSON');
  return parsed;
}

// ── Staging storage ───────────────────────────────────────────────────────

function ensureStagingDir() { mkdirSync(STAGING_DIR, { recursive: true }); }

function stagingPath(slug) {
  const safe = slug.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  return join(STAGING_DIR, `${safe}.json`);
}

function saveReportToStaging(slug, report) {
  ensureStagingDir();
  writeFileSync(stagingPath(slug), JSON.stringify(report, null, 2) + '\n', 'utf-8');
}

export function loadReportFromStaging(slug) {
  const path = stagingPath(slug);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

// ── Main exported function ────────────────────────────────────────────────

export async function runResearch(description, mode, candidateSlug, onProgress = () => {}) {
  const validModes = ['app', 'site', 'feature', 'startup'];
  if (!validModes.includes(mode)) {
    throw new Error(`Invalid mode "${mode}". Must be one of: ${validModes.join(', ')}`);
  }
  if (!description?.trim()) throw new Error('description is required');

  const startedAt = Date.now();
  let timeoutHandle = null;

  const researchPromise = (async () => {
    // Step 1: Infer search plan
    onProgress('Inferring search plan', 'infer_plan', 0, false);
    const plan = await inferSearchPlan(description.trim(), mode);
    onProgress('Inferring search plan', 'infer_plan', 0, true);

    // Step 2: Execute searches
    onProgress('Executing web searches', 'execute_searches', 1, false);
    const searchResults = await executeSearches(plan.queries);
    const webHits = searchResults.filter((r) => r.source === 'web_search').length;
    const llmFallbacks = searchResults.filter((r) => r.source === 'llm_knowledge').length;
    onProgress(`Searches complete: ${webHits} web, ${llmFallbacks} fallback`, 'execute_searches', 1, true);

    // Step 3: Cross-validate
    onProgress('Cross-validating results', 'cross_validate', 2, false);
    const validation = crossValidate(searchResults);
    onProgress('Cross-validating results', 'cross_validate', 2, true);

    // Step 4: Validate assets
    onProgress('Validating assets', 'validate_assets', 3, false);
    const validatedAssets = await validateAssets([]);
    onProgress('Validating assets', 'validate_assets', 3, true);

    // Step 5: Synthesize report
    onProgress('Synthesizing final report', 'synthesize', 4, false);
    const rawReport = await synthesizeReport(searchResults, plan, mode, description.trim());
    onProgress('Synthesizing final report', 'synthesize', 4, true);

    const durationMs = Date.now() - startedAt;

    const report = {
      version: 1,
      generated_at: new Date().toISOString(),
      duration_ms: durationMs,
      mode,
      description: description.trim(),
      entity_type: rawReport.entity_type || plan.entity_type || 'product',
      entity_name: rawReport.entity_name ?? plan.entity_name ?? null,
      user_goals: Array.isArray(rawReport.user_goals) && rawReport.user_goals.length > 0
        ? rawReport.user_goals
        : plan.user_goals,
      search_plan: { queries: plan.queries, rationale: plan.rationale },
      competitors: Array.isArray(rawReport.competitors) ? rawReport.competitors : [],
      defensible_angle: rawReport.defensible_angle || { open_angle: '', rationale: '', confidence: 0.5 },
      tech_feasibility: mode === 'site' || mode === 'startup'
        ? null
        : rawReport.tech_feasibility || { build_complexity: 'medium', key_libraries: [], known_pitfalls: [], confidence: 0.5 },
      trend: rawReport.trend || { momentum: 'stable', recent_events: [], confidence: 0.5 },
      assets: validatedAssets.length > 0
        ? validatedAssets
        : Array.isArray(rawReport.assets) ? rawReport.assets : [],
      question_elimination_map: {
        clarify_language: null,
        clarify_design_feel: null,
        clarify_font_style: null,
        clarify_visual_palette: null,
        clarify_target_audience: null,
        clarify_market_size: null,
        ...(rawReport.question_elimination_map || {}),
      },
      low_confidence_questions: Array.isArray(rawReport.low_confidence_questions)
        ? rawReport.low_confidence_questions
        : [],
      gaps: [...validation.gaps, ...(Array.isArray(rawReport.gaps) ? rawReport.gaps : [])],
      confidence: {
        entity: 0.9, competitors: 0.8, assets: 0.6, tech: 0.7, trends: 0.6,
        ...(rawReport.confidence || {}),
      },
      _meta: {
        search_sources: {
          web_search: webHits,
          llm_knowledge: llmFallbacks,
          failed: searchResults.filter((r) => r.source === 'error').length,
        },
        cross_validation: { confidence: validation.confidence, conflicts: validation.conflicts },
      },
    };

    try { saveReportToStaging(candidateSlug, report); } catch { /* non-fatal */ }
    return report;
  })();

  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Research timed out after ${TOTAL_TIMEOUT_MS / 1000}s`));
    }, TOTAL_TIMEOUT_MS);
  });

  try {
    return await Promise.race([researchPromise, timeoutPromise]);
  } finally {
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
  }
}
