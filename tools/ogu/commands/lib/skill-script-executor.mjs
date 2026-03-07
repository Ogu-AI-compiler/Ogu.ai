/**
 * skill-script-executor.mjs — Slice 400
 * Executes and loads scripts referenced in SKILL.md ## Scripts sections.
 *
 * SKILL.md ## Scripts format:
 *   ## Scripts
 *   - `scripts/analyze.mjs` — analyzes artifacts and reports issues
 *   - `path/to/shared.py` — shared utility script
 *
 * Two modes:
 *   - Execute: actually runs the script via child_process and captures stdout
 *   - Load: reads script content for inclusion in LLM context (Level 3 loading)
 *
 * Script paths are resolved relative to:
 *   1. The skill directory (skills/{name}/)
 *   2. The skills root directory (skills/)
 *   3. The repo root (process.cwd())
 */

import { existsSync, readFileSync } from "node:fs";
import { join, extname, isAbsolute } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

// ── Script reference parser ───────────────────────────────────────────────────

/**
 * parseScriptRefs(skillBody) → ScriptRef[]
 * Parses ## Scripts section from SKILL.md body.
 *
 * Returns: [{ path, description, extension }]
 */
export function parseScriptRefs(skillBody) {
  if (!skillBody || typeof skillBody !== "string") return [];

  // Find ## Scripts section
  const scriptsMatch = skillBody.match(/##\s+Scripts\s*\n([\s\S]*?)(?=\n##\s|\n---\s*\n|$)/);
  if (!scriptsMatch) return [];

  const section = scriptsMatch[1];
  const refs = [];

  // Parse lines like: - `scripts/analyze.mjs` — description
  //                or: - `path/to/script.py`
  const lineRegex = /^\s*[-*]\s+`([^`]+)`(?:\s*[—–-]+\s*(.*))?$/gm;
  let m;
  while ((m = lineRegex.exec(section)) !== null) {
    const path = m[1].trim();
    const description = (m[2] || "").trim();
    const extension = extname(path).toLowerCase();
    if (path) refs.push({ path, description, extension });
  }

  return refs;
}

// ── Path resolution ───────────────────────────────────────────────────────────

/**
 * resolveScriptPath(scriptRef, skillsDir, skillName, cwd?) → string | null
 * Resolves a script path relative to the skill directory, skills root, or repo root.
 * Returns null if not found.
 */
export function resolveScriptPath(scriptRef, skillsDir, skillName, cwd) {
  if (!scriptRef) return null;
  const repoRoot = cwd || process.cwd();

  const candidates = [
    // Absolute path
    isAbsolute(scriptRef) ? scriptRef : null,
    // Relative to skill directory: skills/{skillName}/scripts/...
    skillName ? join(skillsDir, skillName, scriptRef) : null,
    // Relative to skills root
    join(skillsDir, scriptRef),
    // Relative to repo root
    join(repoRoot, scriptRef),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

// ── Script content loader (Level 3) ──────────────────────────────────────────

/**
 * loadScriptContent(scriptPath, opts?) → { content, path, found }
 * Reads script file content for inclusion in LLM context.
 * This is Level 3 progressive context loading — loaded on demand only.
 */
export function loadScriptContent(scriptPath, opts = {}) {
  if (!scriptPath) return { content: null, path: scriptPath, found: false };

  const maxBytes = opts.maxBytes ?? 32 * 1024; // 32 KB default

  try {
    const content = readFileSync(scriptPath, "utf-8");
    const truncated = content.length > maxBytes ? content.slice(0, maxBytes) + "\n// [truncated]" : content;
    return { content: truncated, path: scriptPath, found: true };
  } catch {
    return { content: null, path: scriptPath, found: false };
  }
}

// ── Script executor ───────────────────────────────────────────────────────────

/**
 * executeSkillScript(scriptPath, opts?) → ExecutionResult
 * Runs a script and captures its output.
 *
 * opts.args: string[] — arguments to pass to the script
 * opts.cwd: string — working directory (default: process.cwd())
 * opts.timeout: number — timeout in ms (default: 30000)
 * opts.env: object — additional env vars
 *
 * Returns: { stdout, stderr, exitCode, success, error? }
 */
export function executeSkillScript(scriptPath, opts = {}) {
  if (!scriptPath || !existsSync(scriptPath)) {
    return { stdout: "", stderr: `Script not found: ${scriptPath}`, exitCode: 1, success: false };
  }

  const args = opts.args || [];
  const cwd = opts.cwd || process.cwd();
  const timeout = opts.timeout ?? 30000;
  const ext = extname(scriptPath).toLowerCase();

  // Select runtime
  const [runtime, runtimeArgs] = selectRuntime(ext, scriptPath);

  try {
    const result = spawnSync(runtime, [...runtimeArgs, ...args], {
      cwd,
      timeout,
      encoding: "utf-8",
      env: { ...process.env, ...(opts.env || {}) },
    });

    return {
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      exitCode: result.status ?? 1,
      success: result.status === 0,
      signal: result.signal || null,
    };
  } catch (e) {
    return {
      stdout: "",
      stderr: e.message,
      exitCode: 1,
      success: false,
      error: e.message,
    };
  }
}

/**
 * selectRuntime(ext, scriptPath) → [runtime, args]
 * Picks the correct runtime for a script extension.
 */
export function selectRuntime(ext, scriptPath) {
  switch (ext) {
    case ".mjs":
    case ".js":  return ["node", [scriptPath]];
    case ".ts":  return ["npx", ["tsx", scriptPath]];
    case ".py":  return ["python3", [scriptPath]];
    case ".sh":  return ["bash", [scriptPath]];
    case ".rb":  return ["ruby", [scriptPath]];
    default:     return ["node", [scriptPath]]; // fallback
  }
}

// ── Batch runner ──────────────────────────────────────────────────────────────

/**
 * runSkillScripts(skillBody, skillsDir, skillName, opts?) → RunResult[]
 * Parses ## Scripts section and executes all referenced scripts.
 *
 * Returns: [{ ref, resolvedPath, stdout, stderr, exitCode, success }]
 */
export function runSkillScripts(skillBody, skillsDir, skillName, opts = {}) {
  const refs = parseScriptRefs(skillBody);
  if (refs.length === 0) return [];

  return refs.map(ref => {
    const resolvedPath = resolveScriptPath(ref.path, skillsDir, skillName, opts.cwd);
    if (!resolvedPath) {
      return { ref, resolvedPath: null, stdout: "", stderr: `Not found: ${ref.path}`, exitCode: 1, success: false };
    }
    const result = executeSkillScript(resolvedPath, opts);
    return { ref, resolvedPath, ...result };
  });
}

// ── Context builder (for LLM injection) ──────────────────────────────────────

/**
 * buildScriptContext(skillBody, skillsDir, skillName, opts?) → string
 * Loads script contents for inclusion in LLM context (Level 3 loading).
 * Does NOT execute scripts — only reads their content.
 *
 * Returns formatted string with script contents or empty string.
 */
export function buildScriptContext(skillBody, skillsDir, skillName, opts = {}) {
  const refs = parseScriptRefs(skillBody);
  if (refs.length === 0) return "";

  const sections = ["## Script Context (Level 3 — Loaded on Demand)"];

  for (const ref of refs) {
    const resolvedPath = resolveScriptPath(ref.path, skillsDir, skillName, opts.cwd);
    if (!resolvedPath) {
      sections.push(`### ${ref.path}\n_Script not found at expected locations._`);
      continue;
    }
    const { content, found } = loadScriptContent(resolvedPath, opts);
    if (found && content) {
      const lang = extname(resolvedPath).replace(".", "") || "js";
      sections.push(`### ${ref.path}${ref.description ? `\n_${ref.description}_` : ""}\n\`\`\`${lang}\n${content}\n\`\`\``);
    } else {
      sections.push(`### ${ref.path}\n_Could not load script content._`);
    }
  }

  return sections.length > 1 ? sections.join("\n\n") : "";
}

/**
 * buildScriptOutputContext(runResults) → string
 * Formats script execution results for injection into task context.
 */
export function buildScriptOutputContext(runResults) {
  if (!Array.isArray(runResults) || runResults.length === 0) return "";

  const sections = ["## Script Execution Results"];

  for (const r of runResults) {
    const status = r.success ? "✓ success" : `✗ exit code ${r.exitCode}`;
    const lines = [`### ${r.ref?.path || r.resolvedPath || "script"} — ${status}`];
    if (r.stdout?.trim()) lines.push("**Output:**\n```\n" + r.stdout.trim() + "\n```");
    if (r.stderr?.trim()) lines.push("**Errors:**\n```\n" + r.stderr.trim() + "\n```");
    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n");
}
