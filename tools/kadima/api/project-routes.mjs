/**
 * Project management routes — state, features, file browser, data APIs.
 * Part of the Kadima API.
 *
 * Handles the broad set of /api/* project management endpoints that are NOT
 * covered by exec-routes, ogu-routes, marketplace-routes, wizard-routes, or brief-routes.
 */

import { readFileSync, readdirSync, existsSync, statSync, writeFileSync, mkdirSync, rmSync, appendFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

import { readProjectRegistry, registerProject } from './brief-routes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_DIR   = resolve(__dirname, '..', '..', 'ogu', 'commands', 'lib');
const CLI_PATH  = resolve(__dirname, '..', '..', 'ogu', 'cli.mjs');

// Re-export for external callers
export { readProjectRegistry, registerProject };

function getRoot() { return process.env.OGU_ROOT || process.cwd(); }

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}
function readText(path) {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

function hasRealContent(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const stripped = content
      .replace(/^#+ .+$/gm, '')
      .replace(/<!--.*?-->/gs, '')
      .replace(/^-\s*\[\s*\]\s*$/gm, '')
      .replace(/^\|.*\|$/gm, '')
      .replace(/^\s*$/gm, '')
      .trim();
    return stripped.length > 20;
  } catch { return false; }
}

function detectPhase(featureDir) {
  const has       = (f) => existsSync(join(featureDir, f));
  const hasFilled = (f) => has(f) && hasRealContent(join(featureDir, f));

  if (has('METRICS.json')) {
    const m = readJson(join(featureDir, 'METRICS.json'));
    if (m?.completed) return 'done';
  }
  if (has('Plan.json') && has('Spec.md')) {
    const spec = readText(join(featureDir, 'Spec.md'));
    const plan = readJson(join(featureDir, 'Plan.json'));
    const specFilled = !spec.includes('<!-- TO BE FILLED BY /architect -->') && hasRealContent(join(featureDir, 'Spec.md'));
    const planHasTasks = plan?.tasks?.length > 0;
    if (specFilled && planHasTasks) return 'ready';
  }
  if (hasFilled('PRD.md')) return 'architect';
  if (hasFilled('ProjectBrief.md') || hasFilled('IDEA.md')) return 'feature';
  return 'idea';
}

function scanFeatures() {
  const results = [];
  const seen = new Set();

  const currentRoot = getRoot();
  const featuresDir = join(currentRoot, 'docs/vault/04_Features');
  if (existsSync(featuresDir)) {
    for (const d of readdirSync(featuresDir, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name === 'Index.md') continue;
      const dir = join(featuresDir, d.name);
      const phase = detectPhase(dir);
      const plan = readJson(join(dir, 'Plan.json'));
      results.push({ slug: d.name, phase, tasks: plan?.tasks?.length || 0, root: currentRoot });
      seen.add(d.name);
    }
  }

  for (const entry of readProjectRegistry()) {
    if (seen.has(entry.slug) || !existsSync(entry.root)) continue;
    const projFeaturesDir = join(entry.root, 'docs/vault/04_Features');
    if (!existsSync(projFeaturesDir)) continue;
    for (const d of readdirSync(projFeaturesDir, { withFileTypes: true })) {
      if (!d.isDirectory() || seen.has(d.name)) continue;
      const dir = join(projFeaturesDir, d.name);
      const phase = detectPhase(dir);
      const plan = readJson(join(dir, 'Plan.json'));
      results.push({ slug: d.name, phase, tasks: plan?.tasks?.length || 0, root: entry.root });
      seen.add(d.name);
    }
  }

  const order = { done: 0, ready: 1, architect: 2, feature: 3, idea: 4 };
  return results.sort((a, b) => (order[a.phase] ?? 5) - (order[b.phase] ?? 5));
}

function resolveProjectRoot(slug) {
  const defaultRoot = getRoot();
  if (existsSync(join(defaultRoot, 'docs/vault/04_Features', slug))) return defaultRoot;
  const entry = readProjectRegistry().find((p) => p.slug === slug);
  if (entry && existsSync(entry.root)) return entry.root;
  return defaultRoot;
}

function runOguInit(projectRoot) {
  spawnSync('node', [CLI_PATH, 'init'], {
    cwd: projectRoot,
    env: { ...process.env, OGU_ROOT: projectRoot },
    stdio: 'ignore',
    timeout: 15000,
  });
}

const IGNORE = new Set(['tools', 'CLAUDE.md', 'docs', 'node_modules', '.git', 'dist', '.DS_Store', '.ogu', '.claude']);

function scanDir(dir, depth, maxDepth) {
  if (depth > maxDepth) return [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    const nodes = [];
    for (const entry of entries) {
      if (IGNORE.has(entry.name) || entry.name.startsWith('.')) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        nodes.push({ name: entry.name, type: 'dir', children: scanDir(fullPath, depth + 1, maxDepth) });
      } else {
        try { nodes.push({ name: entry.name, type: 'file', size: statSync(fullPath).size }); }
        catch { nodes.push({ name: entry.name, type: 'file' }); }
      }
    }
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch { return []; }
}

// Simple LRU-ish cache for expensive calls
const _cache = new Map();
function cachedGet(key, ttlMs, fn) {
  const now = Date.now();
  const hit = _cache.get(key);
  if (hit && now - hit.ts < ttlMs) return hit.val;
  const val = fn();
  _cache.set(key, { val, ts: now });
  return val;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function handleProjectRoutes(url, method, readBody, res, root, broadcaster, json) {
  const path = url.pathname;

  // ── State ──
  if (path === '/api/state' && method === 'GET') {
    const oguDir = join(getRoot(), '.ogu');
    const state   = readJson(join(oguDir, 'STATE.json'))   || {};
    const theme   = readJson(join(oguDir, 'THEME.json'))   || {};
    const profile = readJson(join(oguDir, 'PROFILE.json')) || {};
    const valid   = existsSync(join(oguDir, 'STATE.json')) || existsSync(join(oguDir, 'PROFILE.json'));
    json(res, 200, { state, theme, profile, root: getRoot(), valid });
    return true;
  }

  if (path === '/api/state/gates' && method === 'GET') {
    const gates = readJson(join(getRoot(), '.ogu', 'GATE_STATE.json')) || {};
    json(res, 200, gates);
    return true;
  }

  if (path === '/api/state/involvement' && method === 'POST') {
    const body = await readBody();
    const { level } = body;
    const validLevels = ['autopilot', 'guided', 'product-focused', 'hands-on'];
    if (!level || !validLevels.includes(level)) {
      json(res, 400, { error: `Invalid level. Must be one of: ${validLevels.join(', ')}` });
      return true;
    }
    try {
      const { resolveRuntimePath } = await import(`${LIB_DIR}/runtime-paths.mjs`);
      const statePath = resolveRuntimePath(getRoot(), 'STATE.json');
      const state = readJson(statePath) || {};
      state.involvement_level = level;
      writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
    } catch { /* best-effort */ }
    json(res, 200, { ok: true, level });
    return true;
  }

  // ── Features ──
  if (path === '/api/features' && method === 'GET') {
    const features = scanFeatures();
    const state = readJson(join(getRoot(), '.ogu', 'STATE.json'));
    json(res, 200, { features, active: state?.current_task || null });
    return true;
  }

  // POST /api/features/:slug/activate
  const activateMatch = path.match(/^\/api\/features\/([^/]+)\/activate$/);
  if (activateMatch && method === 'POST') {
    const slug = activateMatch[1];
    const features = scanFeatures();
    const match = features.find((f) => f.slug === slug);
    if (!match || !match.root) { json(res, 404, { error: 'Project not found' }); return true; }
    process.env.OGU_ROOT = match.root;
    json(res, 200, { ok: true, root: match.root });
    return true;
  }

  // DELETE /api/features/:slug
  const featureSlugMatch = path.match(/^\/api\/features\/([^/]+)$/);
  if (featureSlugMatch && method === 'DELETE') {
    const slug = featureSlugMatch[1];
    if (!slug || slug.includes('..') || slug.includes('/')) { json(res, 400, { error: 'Invalid slug' }); return true; }

    const features = scanFeatures();
    const match = features.find((f) => f.slug === slug);
    if (!match || !match.root) { json(res, 404, { error: 'Feature not found' }); return true; }

    // Abort pipeline
    try {
      const { abortPipeline } = await import('../execution/dispatch.mjs');
      abortPipeline(slug, match.root);
    } catch { /* best-effort */ }

    // Clear active pointer
    try {
      const { resolveRuntimePath } = await import(`${LIB_DIR}/runtime-paths.mjs`);
      const statePath = resolveRuntimePath(match.root, 'STATE.json');
      const state = readJson(statePath) || {};
      if (state.current_task === slug) { delete state.current_task; writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8'); }
    } catch { /* best-effort */ }

    // Delete feature vault dir
    const dir = join(match.root, 'docs/vault/04_Features', slug);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });

    // Delete .ogu/projects/{slug}
    try {
      const { resolveRuntimePath, getRunnersDir } = await import(`${LIB_DIR}/runtime-paths.mjs`);
      const projectDir   = resolveRuntimePath(match.root, 'projects', slug);
      const fsmState     = resolveRuntimePath(match.root, 'state', 'features', `${slug}.state.json`);
      const abortMarker  = resolveRuntimePath(match.root, 'state', 'features', `${slug}.aborted`);
      const dispatchSt   = resolveRuntimePath(match.root, 'state', 'dispatch', `${slug}.json`);
      if (existsSync(projectDir))  rmSync(projectDir,  { recursive: true, force: true });
      if (existsSync(fsmState))    rmSync(fsmState,    { force: true });
      if (existsSync(abortMarker)) rmSync(abortMarker, { force: true });
      if (existsSync(dispatchSt))  rmSync(dispatchSt,  { force: true });

      const runnersDir = getRunnersDir(match.root);
      if (existsSync(runnersDir)) {
        for (const f of readdirSync(runnersDir)) {
          if (!f.endsWith('.json')) continue;
          try {
            const data = JSON.parse(readFileSync(join(runnersDir, f), 'utf8'));
            if (data?.featureSlug === slug || data?.slug === slug) rmSync(join(runnersDir, f), { force: true });
          } catch {}
        }
      }
    } catch { /* best-effort */ }

    // Remove from registry + delete standalone project dir
    try {
      const REGISTRY_PATH = join(homedir(), '.ogu', 'kadima-projects.json');
      const allEntries = readProjectRegistry();
      const entry = allEntries.find((p) => p.slug === slug);
      const filtered = allEntries.filter((p) => p.slug !== slug);
      mkdirSync(join(homedir(), '.ogu'), { recursive: true });
      writeFileSync(REGISTRY_PATH, JSON.stringify({ projects: filtered }, null, 2) + '\n', 'utf8');
      if (entry?.root && existsSync(entry.root)) {
        const base = entry.root.replace(/\/$/, '').split('/').pop() || '';
        if (base === slug || base.startsWith(slug + '-')) {
          rmSync(entry.root, { recursive: true, force: true });
          if (process.env.OGU_ROOT === entry.root) delete process.env.OGU_ROOT;
        }
      }
    } catch { /* best-effort */ }

    // Release marketplace allocations
    try {
      const { listProjectAllocations, releaseAgent } = await import(`${LIB_DIR}/marketplace-allocator.mjs`);
      const allocs = listProjectAllocations(match.root, slug);
      for (const alloc of allocs) { try { releaseAgent(match.root, alloc.allocation_id); } catch {} }
    } catch { /* lib not available */ }

    json(res, 200, { ok: true, deleted: slug });
    return true;
  }

  // GET /api/features/:slug
  if (featureSlugMatch && method === 'GET') {
    const slug = featureSlugMatch[1];
    const featuresDir = join(getRoot(), 'docs/vault/04_Features');
    const dir = join(featuresDir, slug);
    if (!existsSync(dir)) { json(res, 404, { error: 'Feature not found' }); return true; }
    json(res, 200, {
      slug,
      phase:   detectPhase(dir),
      prd:     readText(join(dir, 'PRD.md')),
      spec:    readText(join(dir, 'Spec.md')),
      plan:    readJson(join(dir, 'Plan.json')),
      metrics: readJson(join(dir, 'METRICS.json')),
      qa:      readText(join(dir, 'QA.md')),
    });
    return true;
  }

  // ── Project management ──
  if (path === '/api/project/open' && method === 'POST') {
    const body = await readBody();
    const projectPath = body.path;
    if (!projectPath) { json(res, 400, { error: 'path is required' }); return true; }
    const resolved = resolve(projectPath);
    if (!existsSync(resolved)) { json(res, 400, { error: 'Directory does not exist' }); return true; }
    const oguDir = join(resolved, '.ogu');
    if (!existsSync(join(oguDir, 'STATE.json'))) { mkdirSync(resolved, { recursive: true }); runOguInit(resolved); }
    process.env.OGU_ROOT = resolved;
    json(res, 200, { ok: true, root: resolved });
    return true;
  }

  if (path === '/api/project/init' && method === 'POST') {
    const body = await readBody();
    const projectPath = body.path;
    if (!projectPath) { json(res, 400, { error: 'path is required' }); return true; }
    const resolved = projectPath.startsWith('/') ? resolve(projectPath) : resolve(homedir(), projectPath);
    mkdirSync(resolved, { recursive: true });
    runOguInit(resolved);
    process.env.OGU_ROOT = resolved;
    json(res, 200, { ok: true, valid: true, root: resolved });
    return true;
  }

  if (path === '/api/project/delete' && method === 'POST') {
    const body = await readBody();
    const projectPath = body.path;
    if (!projectPath) { json(res, 400, { error: 'path is required' }); return true; }
    const resolved = resolve(projectPath);
    if (!existsSync(resolved)) {
      if (process.env.OGU_ROOT === resolved) delete process.env.OGU_ROOT;
      json(res, 200, { ok: true, deleted: resolved });
      return true;
    }
    if (existsSync(join(resolved, '.ogu')) || existsSync(join(resolved, 'docs', 'vault'))) {
      rmSync(resolved, { recursive: true, force: true });
    }
    if (process.env.OGU_ROOT === resolved) delete process.env.OGU_ROOT;
    // Clean port registry
    try {
      const registryPath = join(homedir(), '.ogu', 'port-registry.json');
      if (existsSync(registryPath)) {
        const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
        if (registry.projects?.[resolved]) {
          delete registry.projects[resolved];
          writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
        }
      }
    } catch { /* best-effort */ }
    json(res, 200, { ok: true, deleted: resolved });
    return true;
  }

  // Project lifecycle controls
  const projectAbortMatch  = path.match(/^\/api\/project\/([^/]+)\/abort$/);
  const projectPauseMatch  = path.match(/^\/api\/project\/([^/]+)\/pause$/);
  const projectResumeMatch = path.match(/^\/api\/project\/([^/]+)\/resume$/);

  if (projectAbortMatch && method === 'POST') {
    const slug = projectAbortMatch[1];
    const projectRoot = resolveProjectRoot(slug);
    try {
      const { abortPipeline } = await import('../execution/dispatch.mjs');
      abortPipeline(slug, projectRoot);
    } catch { /* best-effort */ }
    try {
      const { listProjectAllocations, releaseAgent } = await import(`${LIB_DIR}/marketplace-allocator.mjs`);
      const allocs = listProjectAllocations(projectRoot, slug);
      for (const alloc of allocs) { try { releaseAgent(projectRoot, alloc.allocation_id); } catch {} }
    } catch { /* best-effort */ }
    broadcaster.broadcast({ type: 'dispatch:aborted', slug });
    json(res, 200, { ok: true, aborted: slug });
    return true;
  }

  if (projectPauseMatch && method === 'POST') {
    const slug = projectPauseMatch[1];
    const projectRoot = resolveProjectRoot(slug);
    try {
      const { pausePipeline } = await import('../execution/dispatch.mjs');
      pausePipeline(slug, projectRoot);
    } catch { /* best-effort */ }
    broadcaster.broadcast({ type: 'dispatch:paused', slug });
    json(res, 200, { ok: true, paused: slug });
    return true;
  }

  if (projectResumeMatch && method === 'POST') {
    const slug = projectResumeMatch[1];
    const projectRoot = resolveProjectRoot(slug);
    ;(async () => {
      try {
        broadcaster.broadcast({ type: 'cto:thinking_line', slug, text: 'Resume requested' });
        broadcaster.broadcast({ type: 'dispatch:retrying', slug });
        const { retryFailedTasks, resumePipeline } = await import('../execution/dispatch.mjs');
        const result = await retryFailedTasks(projectRoot, slug);
        if (result.retried.length > 0 || result.errors.length > 0) {
          broadcaster.broadcast({ type: 'dispatch:retry_done', slug, retried: result.retried.length, errors: result.errors });
        }
        resumePipeline(slug, projectRoot);
        broadcaster.broadcast({ type: 'dispatch:resumed', slug });
      } catch { /* best-effort */ }
    })();
    json(res, 200, { ok: true, resumed: slug });
    return true;
  }

  // GET /api/project/active
  if (path === '/api/project/active' && method === 'GET') {
    const registry = readProjectRegistry()
      .filter((p) => existsSync(p.root))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (registry.length === 0) { json(res, 200, { project: null }); return true; }
    const latest = registry[0];
    json(res, 200, { project: { slug: latest.slug, root: latest.root } });
    return true;
  }

  // ── Sessions ──
  if (path === '/api/sessions' && method === 'GET') {
    const sessionsFile = join(getRoot(), '.ogu', 'kadima-sessions.json');
    if (!existsSync(sessionsFile)) { json(res, 200, { sessions: null }); return true; }
    try { json(res, 200, { sessions: JSON.parse(readFileSync(sessionsFile, 'utf8')) }); }
    catch { json(res, 200, { sessions: null }); }
    return true;
  }

  if (path === '/api/sessions' && method === 'POST') {
    const body = await readBody();
    const oguDir = join(getRoot(), '.ogu');
    if (!existsSync(oguDir)) mkdirSync(oguDir, { recursive: true });
    const sessionsFile = join(oguDir, 'kadima-sessions.json');
    try {
      writeFileSync(sessionsFile, JSON.stringify(body, null, 2) + '\n');
      json(res, 200, { ok: true });
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return true;
  }

  // ── Search ──
  if (path === '/api/search' && method === 'GET') {
    const query = url.searchParams.get('q') || '';
    const types = url.searchParams.get('types')?.split(',').filter(Boolean);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    if (!query) { json(res, 200, { results: [] }); return true; }
    try {
      const { search } = await import(`${LIB_DIR}/global-search.mjs`);
      const results = search({ root: getRoot(), query, types, limit });
      json(res, 200, { results });
    } catch {
      json(res, 200, { results: [] });
    }
    return true;
  }

  // ── Dashboard ──
  if (path === '/api/dashboard/snapshot' && method === 'GET') {
    try {
      const { getDashboardSnapshot } = await import(`${LIB_DIR}/data-provider.mjs`);
      json(res, 200, getDashboardSnapshot({ root: getRoot() }));
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return true;
  }

  // ── Org data ──
  if (path === '/api/org/data' && method === 'GET') {
    try {
      const { getOrgData } = await import(`${LIB_DIR}/data-provider.mjs`);
      const data = cachedGet(`org:${getRoot()}`, 30000, () => getOrgData({ root: getRoot() }));
      json(res, 200, data);
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return true;
  }

  // ── Budget ──
  if (path === '/api/budget/summary' && method === 'GET') {
    try {
      const { getBudgetSummary } = await import(`${LIB_DIR}/data-layer.mjs`);
      json(res, 200, getBudgetSummary({ root: getRoot() }));
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return true;
  }

  if (path === '/api/budget/data' && method === 'GET') {
    try {
      const { getBudgetData } = await import(`${LIB_DIR}/data-provider.mjs`);
      const data = cachedGet(`budget:${getRoot()}`, 30000, () => getBudgetData({ root: getRoot() }));
      json(res, 200, data);
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return true;
  }

  // ── Audit ──
  if (path === '/api/audit/search' && method === 'GET') {
    try {
      const { searchAudit } = await import(`${LIB_DIR}/data-layer.mjs`);
      const feature  = url.searchParams.get('feature');
      const type     = url.searchParams.get('type');
      const severity = url.searchParams.get('severity');
      const since    = url.searchParams.get('since');
      const limit    = parseInt(url.searchParams.get('limit') || '50', 10);
      const results  = searchAudit({ root: getRoot(), feature, type, severity, since, limit });
      json(res, 200, { results });
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return true;
  }

  if (path === '/api/audit/data' && method === 'GET') {
    try {
      const { getAuditData } = await import(`${LIB_DIR}/data-provider.mjs`);
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      json(res, 200, getAuditData({ root: getRoot(), limit }));
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return true;
  }

  // ── Governance ──
  if (path === '/api/governance/data' && method === 'GET') {
    try {
      const { getGovernanceData } = await import(`${LIB_DIR}/data-provider.mjs`);
      json(res, 200, getGovernanceData({ root: getRoot() }));
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return true;
  }

  // ── Agents data ──
  if (path === '/api/agents/data' && method === 'GET') {
    try {
      const { getAgentData } = await import(`${LIB_DIR}/data-provider.mjs`);
      json(res, 200, getAgentData({ root: getRoot() }));
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return true;
  }

  // ── GenUI Widgets ──
  if (path === '/api/widgets/types' && method === 'GET') {
    try {
      const { WIDGET_TYPES } = await import(`${LIB_DIR}/genui-widgets.mjs`);
      json(res, 200, { types: WIDGET_TYPES });
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return true;
  }

  if (path === '/api/widgets/create' && method === 'POST') {
    const body = await readBody();
    const { type, title, data, style } = body;
    if (!type) { json(res, 400, { error: 'type is required' }); return true; }
    try {
      const { createWidget, WIDGET_TYPES } = await import(`${LIB_DIR}/genui-widgets.mjs`);
      if (!WIDGET_TYPES[type]) { json(res, 400, { error: `Invalid widget type: ${type}` }); return true; }
      const widget = createWidget({ type, title: title || '', data: data || {}, style: style || {} });
      json(res, 200, { widget });
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return true;
  }

  if (path === '/api/widgets/layout' && method === 'POST') {
    const body = await readBody();
    const { widgets = [], columns } = body;
    try {
      const { createDashboardLayout, serializeWidgets } = await import(`${LIB_DIR}/genui-widgets.mjs`);
      const layout = createDashboardLayout({ widgets, columns });
      json(res, 200, { layout, serialized: serializeWidgets(widgets) });
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return true;
  }

  // ── Pipeline progress ──
  if (path === '/api/pipeline/progress' && method === 'GET') {
    json(res, 200, { progress: { completed: 0, total: 100, percentage: 0 }, eta: null });
    return true;
  }

  if (path === '/api/pipeline/progress' && method === 'POST') {
    json(res, 200, { ok: true, progress: { completed: 0, total: 100, percentage: 0 } });
    return true;
  }

  // ── Execution feed ──
  if (path === '/api/execution/feed' && method === 'GET') {
    try {
      const { createExecutionStream } = await import(`${LIB_DIR}/execution-event-stream.mjs`);
      const stream = createExecutionStream({ persistToAudit: false });
      const type        = url.searchParams.get('type') || undefined;
      const taskId      = url.searchParams.get('taskId') || undefined;
      const featureSlug = url.searchParams.get('feature') || undefined;
      const since       = url.searchParams.get('since') || undefined;
      const limit       = parseInt(url.searchParams.get('limit') || '50', 10);
      const events = stream.getHistory({ type, taskId, featureSlug, since, limit });
      json(res, 200, { events, total: events.length });
    } catch {
      json(res, 200, { events: [], total: 0 });
    }
    return true;
  }

  if (path === '/api/execution/stats' && method === 'GET') {
    try {
      const { createExecutionStream } = await import(`${LIB_DIR}/execution-event-stream.mjs`);
      const stream = createExecutionStream({ persistToAudit: false });
      json(res, 200, stream.getStats());
    } catch {
      json(res, 200, { total: 0, byType: {} });
    }
    return true;
  }

  if (path === '/api/execution/events' && method === 'GET') {
    try {
      const { EXECUTION_EVENTS } = await import(`${LIB_DIR}/execution-event-stream.mjs`);
      json(res, 200, { events: EXECUTION_EVENTS });
    } catch {
      json(res, 200, { events: {} });
    }
    return true;
  }

  if (path === '/api/execution/emit' && method === 'POST') {
    const body = await readBody();
    if (!body.type) { json(res, 400, { error: 'type is required' }); return true; }
    try {
      const { createExecutionStream } = await import(`${LIB_DIR}/execution-event-stream.mjs`);
      const stream = createExecutionStream({ persistToAudit: true });
      const event = stream.emit(body.type, body.payload || {});
      json(res, 200, { event });
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return true;
  }

  // ── Logs ──
  if (path === '/api/logs/recent' && method === 'GET') {
    const logsDir = join(getRoot(), 'docs/vault/01_Daily');
    if (!existsSync(logsDir)) { json(res, 200, []); return true; }
    const files = readdirSync(logsDir).filter((f) => f.endsWith('.md')).sort().slice(-3);
    json(res, 200, files.map((f) => ({ name: f.replace('.md', ''), content: readText(join(logsDir, f)) })));
    return true;
  }

  // ── Theme presets ──
  if (path === '/api/theme/presets' && method === 'GET') {
    try {
      const { presets } = await import('../lib/theme-presets.mjs');
      json(res, 200, presets);
    } catch {
      json(res, 200, []);
    }
    return true;
  }

  // ── File tree ──
  if (path === '/api/files' && method === 'GET') {
    const depth = parseInt(url.searchParams.get('depth') || '4', 10);
    const children = scanDir(getRoot(), 0, Math.min(depth, 6));
    json(res, 200, { name: '.', type: 'dir', children });
    return true;
  }

  // ── Dir browser ──
  if (path === '/api/dirs' && method === 'GET') {
    const dir      = url.searchParams.get('path') || homedir();
    const resolved = resolve(dir);
    if (!existsSync(resolved)) { json(res, 404, { error: 'Not found' }); return true; }
    try {
      const entries = readdirSync(resolved, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name)
        .sort();
      const hasOgu = existsSync(join(resolved, '.ogu', 'STATE.json'));
      json(res, 200, { path: resolved, dirs: entries, hasOgu });
    } catch {
      json(res, 400, { error: 'Cannot read directory' });
    }
    return true;
  }

  // ── Billing stubs ──
  if (path === '/api/billing/subscription' && method === 'GET') {
    json(res, 200, {
      plan: { id: 'free', name: 'Free', compilationsPerMonth: 3, storageGb: 1, agentsMax: 5 },
      balance: 0, usage: { compilations: 0, agentHires: 0 },
    });
    return true;
  }
  if (path === '/api/billing/checkout' && method === 'POST') {
    json(res, 400, { error: 'Billing not configured — enable AOAS mode for payments' });
    return true;
  }
  if (path === '/api/billing/portal' && method === 'POST') {
    json(res, 400, { error: 'Billing not configured — enable AOAS mode for payments' });
    return true;
  }
  if (path === '/api/billing/credits' && method === 'GET') {
    json(res, 200, { balance: 0, transactions: [] });
    return true;
  }

  return false;
}
