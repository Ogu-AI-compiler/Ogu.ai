import { Hono } from "hono";
import { spawn } from "child_process";
import { streamSSE } from "hono/streaming";
import { buildSystemPrompt, getStateSummary } from "./pipeline.js";
import { guardPhase, detectCurrentPhase, getActiveSlug } from "./phase-guard.js";
import { routeChat, recordChatSpend, computeCost, getBudgetStatus, type RoutingDecision } from "./model-bridge.js";
import { existsSync, readFileSync, readdirSync, statSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";

/** Emit a lightweight audit event for chat activity. */
function emitChatAudit(root: string, type: string, data: Record<string, unknown>) {
  try {
    const auditDir = join(root, ".ogu", "audit");
    if (!existsSync(auditDir)) mkdirSync(auditDir, { recursive: true });
    const entry = { type, timestamp: new Date().toISOString(), data, source: "studio-chat" };
    appendFileSync(join(auditDir, "current.jsonl"), JSON.stringify(entry) + "\n");
  } catch { /* audit is best-effort */ }
}

/** Build a conversation summary from stored session lines for context recovery */
function buildSessionContext(root: string, targetSessionId?: string): string {
  const sessionsFile = join(root, ".ogu", "studio-sessions.json");
  if (!existsSync(sessionsFile)) return "";
  try {
    const data = JSON.parse(readFileSync(sessionsFile, "utf-8"));
    const sessions = data.sessions || [];
    // Find the session that matches the stale claudeSessionId
    const session = targetSessionId
      ? sessions.find((s: any) => s.claudeSessionId === targetSessionId)
      : sessions[sessions.length - 1];
    if (!session?.lines?.length) return "";

    // Extract user prompts and assistant replies (skip tool/meta/status lines)
    const relevant = session.lines
      .filter((l: any) => l.type === "prompt" || l.type === "reply")
      .slice(-20); // Last 20 exchanges max
    if (relevant.length === 0) return "";

    const summary = relevant
      .map((l: any) => l.type === "prompt" ? `User: ${l.text.replace(/^>\s*/, "")}` : `Ogu: ${l.text}`)
      .join("\n");

    return `\n\n[PREVIOUS CONVERSATION CONTEXT — session expired, continuing seamlessly]\nHere is what was discussed in the previous session. Continue naturally from this context:\n\n${summary}\n\n[END OF PREVIOUS CONTEXT]\n`;
  } catch {
    return "";
  }
}

export function createChatRouter() {
  const chat = new Hono();

  const baseTools = ["Edit", "Write", "Read", "Bash", "Glob", "Grep", "WebFetch", "WebSearch"];

  /* ── Streaming endpoint (SSE) — persistent sessions via --resume ── */
  chat.post("/chat", async (c) => {
    const { message, images, sessionId, model } = await c.req.json() as {
      message?: string;
      images?: string[];
      sessionId?: string;
      model?: string;
    };
    if (!message) return c.json({ error: "message is required" }, 400);

    const root = process.env.OGU_ROOT || process.cwd();

    // ── Phase guard: block messages that skip pipeline phases ──
    const guard = guardPhase(root, message);
    if (!guard.allowed) {
      return streamSSE(c, async (stream) => {
        await stream.writeSSE({
          data: JSON.stringify({
            type: "phase_blocked",
            currentPhase: guard.currentPhase,
            intendedPhase: guard.intendedPhase,
            reason: guard.reason,
            missingFiles: guard.missingFiles,
            slug: guard.slug,
          }),
          event: "phase_blocked",
        });
        await stream.writeSSE({
          data: JSON.stringify({ type: "done", exitCode: 0, sessionId: "" }),
          event: "done",
        });
      });
    }

    // Build user prompt
    let prompt = message;
    if (images && images.length > 0) {
      const imageList = images
        .map((img: string, i: number) => `- Image ${i + 1}: ${img}`)
        .join("\n");
      prompt += `\n\nIMPORTANT: The user has attached ${images.length} image(s). You MUST view them using the Read tool before responding. Read each image file path listed below:\n${imageList}`;
    }

    // ── Phase-aware prompt wrapping ──
    // Don't rely on system prompt alone — wrap the user's actual message with hard constraints.
    const phase = guard.currentPhase;
    if (phase === "discovery") {
      // Always show involvement on first message of a new conversation (no sessionId yet)
      const needsInvolvement = !guard.involvement || !sessionId;
      // Detect user language from message for involvement template
      const isHebrew = /[\u0590-\u05FF]/.test(message);
      const isArabic = /[\u0600-\u06FF]/.test(message);
      const involvementTemplate = isHebrew
        ? `?involvement
טייס אוטומטי|אתה מתאר את הרעיון, אוגו מטפל בהכל מההתחלה עד הסוף.|autopilot
הכוונה קלה|אוגו מוביל את התהליך, אתה מכריע בנקודות מפתח.|guided
מוצר מוביל|אתה מגדיר את המוצר והפיצ׳רים, אוגו בונה.|product-focused
שיתוף פעולה מלא|כל החלטה עוברת דרכך, עובדים ביחד צעד אחרי צעד.|hands-on`
        : isArabic
        ? `?involvement
طيار آلي|تصف الفكرة، أوغو يتولى كل شيء من البداية للنهاية.|autopilot
توجيه خفيف|أوغو يقود العملية، أنت تقرر في النقاط المهمة.|guided
تركيز على المنتج|أنت تحدد المنتج والميزات، أوغو يبني.|product-focused
تعاون كامل|كل قرار يمر من خلالك، نعمل معا خطوة بخطوة.|hands-on`
        : `?involvement
Full Autopilot|You describe the idea, Ogu handles everything from start to finish.|autopilot
Light Guidance|Ogu leads the process, you make the key calls.|guided
Product Focused|You define the product and features, Ogu builds.|product-focused
Deep Collaboration|Every decision goes through you, step by step together.|hands-on`;
      const involvementBlock = needsInvolvement ? `
CRITICAL — INVOLVEMENT LEVEL NOT SET:
Before asking ANY product questions, you MUST first ask the user how they want to work.
Output this EXACT block (the UI converts it to a slider widget). Copy it character-for-character:

${involvementTemplate}

Write a short intro line BEFORE the ?involvement block. Use the same language as the user.
Do NOT modify the ?involvement block content. Do NOT ask any other questions until involvement is set.
` : "";
      prompt = `[DISCOVERY MODE — HARD LOCK]
You are in DISCOVERY phase. There is NO feature created yet.
${involvementBlock}
FORBIDDEN ACTIONS (server will reject if you try):
- Do NOT run npm, npx, yarn, pnpm, bun, pip, cargo, or ANY package manager
- Do NOT run git init, mkdir, or create project directories
- Do NOT write code files (.ts, .tsx, .js, .jsx, .css, .html, .json except IDEA.md)
- Do NOT create or scaffold any application
- Do NOT skip to building, architecting, or implementing

ALLOWED ACTIONS (the ONLY things you may do):
- Ask the user product questions (one question at a time, as bullet choices)
- Discuss the idea, target audience, core features
- Run brand-scan or reference commands via the CLI
- When discovery is complete: run feature:create via CLI, then write IDEA.md

DESIGN EXPLORATION (after product questions, BEFORE writing IDEA.md):
You MUST ask about design preferences. The depth depends on involvement level:
- autopilot: Skip design questions. Use defaults or brand-scan if URL was mentioned.
- guided: Ask 3 questions: layout style, color vibe, reference sites
- product-focused: Ask 4-5 questions: layout, colors, references, screen vision for main screen
- hands-on: Full design brief: layout, colors, references, per-screen vision, component style, animations
Ask each design question as bullet choices (the UI renders them as interactive buttons).
If user provides a brand URL → run brand-scan. If they provide reference URLs → run reference command.
Capture all design decisions in IDEA.md under "## Design preferences".

The user said: ${prompt}

${needsInvolvement ? "First ask about involvement level using the ?involvement pattern above." : "Respond with a product question. Do NOT start building."}`;
    } else if (phase === "feature") {
      prompt = `[FEATURE MODE — HARD LOCK]
You are in FEATURE phase for "${guard.slug}".
IDEA.md is complete. Now you MUST write the product requirements.

YOUR JOB RIGHT NOW:
1. Read IDEA.md to understand the discovery decisions
2. Fill PRD.md with REAL content — Problem, User Personas, Requirements, Success Metrics, Assumptions, Open Questions, Out of Scope
3. Fill the product sections of Spec.md — Overview, User Personas & Permissions, Screens and Interactions, Edge Cases (leave architect sections with "TO BE FILLED BY /architect")
4. Fill QA.md with at least 2 test cases per section
5. Run: feature:validate --phase-1 "${guard.slug}" to verify

FORBIDDEN ACTIONS:
- Do NOT write code files (.ts, .tsx, .js, .jsx, .css, .html)
- Do NOT run npm, npx, yarn, pnpm, bun, pip, cargo, or ANY package manager
- Do NOT create project directories or scaffold anything
- Do NOT skip to building or architecting

When PRD.md, Spec.md (product sections), and QA.md are filled → tell the user feature phase is complete and you're ready for architecture.

The user said: ${prompt}`;
    } else if (phase === "architect") {
      prompt = `[ARCHITECT MODE — HARD LOCK]
You are in ARCHITECT phase for "${guard.slug}".
PRD.md and Spec.md product sections are complete. Now you MUST design the technical architecture.

YOUR JOB RIGHT NOW:
1. Read PRD.md and Spec.md to understand requirements
2. Fill the technical sections of Spec.md — Data Model, API, Mock API, UI Components (remove "TO BE FILLED BY /architect" comments)
3. Create Plan.json with concrete implementation tasks (ordered, with dependencies)
4. Fill docs/vault/01_Architecture/Invariants.md with at least 5 architectural rules
   IMPORTANT: Rules MUST use bullet format "- Rule text here" (NOT numbered lists like "1.")
   Each rule must be meaningful (at least 4 characters after the "- " prefix)
5. Run: feature:validate --phase-2 "${guard.slug}" to verify

FORBIDDEN ACTIONS:
- Do NOT write code files (.ts, .tsx, .js, .jsx, .css, .html)
- Do NOT run npm, npx, yarn, pnpm, bun, pip, cargo, or ANY package manager
- Do NOT create project directories or scaffold anything
- Do NOT skip to building

When Spec.md is fully filled and Plan.json has tasks → tell the user architecture is complete and you're ready for preflight.

The user said: ${prompt}`;
    } else if (phase === "preflight") {
      prompt = `[PREFLIGHT MODE — HARD LOCK]
You are in PREFLIGHT phase for "${guard.slug}".
Architecture is complete. Now verify everything is ready before building.

YOUR JOB RIGHT NOW:
1. Run: doctor (full health check)
2. If doctor reports Invariants.md issues — fix them:
   - Rules MUST use "- " bullet format (NOT numbered lists)
   - Minimum 5 rules required, each at least 4 characters
3. Run: context --feature ${guard.slug}
4. Run: context:lock
5. Read .ogu/CONTEXT.md and verify it has real content
6. Report preflight status to the user

FORBIDDEN ACTIONS:
- Do NOT write code files (.ts, .tsx, .js, .jsx, .css, .html)
- Do NOT run npm, npx, yarn, pnpm, bun, pip, cargo, or ANY package manager
- Do NOT skip to building

When doctor passes → tell the user preflight is complete and ready for build.

The user said: ${prompt}`;
    } else if (phase === "build") {
      const invLevel = guard.involvement || "guided";
      prompt = `[BUILD MODE — HARD LOCK]
You are in BUILD phase for "${guard.slug}".
Involvement level: ${invLevel}.
All planning is complete. Now implement tasks from Plan.json.

YOUR JOB RIGHT NOW:
1. Read Plan.json to get the full task list
2. For EACH task (in order):
   a. Announce: "Task <id>: <title>"
   b. Read the relevant spec_section from Spec.md
   c. Implement the code
   d. Verify against done_when condition
3. After ALL tasks are done, verify the app works end-to-end

CHECKPOINTS (screen-level gates):
Tasks in Plan.json have a "group" field. After completing ALL tasks in a group, follow these rules based on involvement level "${invLevel}":
${invLevel === "autopilot" ? `- AUTOPILOT: Do NOT pause. Build everything continuously. Summarize only at the very end.` :
invLevel === "guided" ? `- GUIDED: After each group, write a brief summary (2-3 bullets of what was built). Ask: "Continue to [next group]?" WAIT for user response before continuing.` :
invLevel === "product-focused" ? `- PRODUCT-FOCUSED: After each group, write a detailed summary - what files were created, what each screen does, how it works. Ask: "Any feedback before I continue to [next group]?" WAIT for user response. If they give feedback, address it FIRST.` :
`- HANDS-ON: After each group, show every file created/modified, explain each design choice. Ask for explicit approval before moving to next group. Address ALL feedback before continuing.`}
${invLevel !== "autopilot" ? `If Plan.json tasks don't have a "group" field, pause every 3-4 tasks.` : ""}

CRITICAL:
- You MUST implement ALL tasks across ALL groups. Do NOT stop partway through a group.
- Follow Plan.json task order and dependencies
- Read the spec section BEFORE implementing each task
- Narrate progress so the user knows what you're doing

RESPOND ONLY IN THE SAME LANGUAGE AS THE USER. Never switch to another language mid-conversation.

The user said: ${prompt}`;
    }

    // ── Phase-aware max-turns ──
    // Discovery: 25 turns (ask questions + write IDEA.md + run feature:create)
    // Feature/Architect: 40 turns (read IDEA + write PRD + Spec + QA / fill Spec + Plan)
    // Preflight: 20 turns (run doctor, context, lock)
    // Build: 120 turns (implement ALL Plan.json tasks — ~5 turns/task × 19+ tasks)
    // Gates/Deliver: 30 turns
    const maxTurns = phase === "discovery" ? 25
      : (phase === "feature" || phase === "architect") ? 40
      : phase === "preflight" ? 20
      : phase === "build" ? 120
      : 30;

    // Build claude CLI args
    const args: string[] = [];
    if (sessionId) {
      // Resume existing conversation — inject identity + current state + phase enforcement
      const stateSummary = getStateSummary(root);
      const phaseTag = `[PHASE: ${phase.toUpperCase()}]`;
      const involvementTag = guard.involvement
        ? `[INVOLVEMENT: ${guard.involvement}]`
        : `[INVOLVEMENT: NOT SET — MUST ASK BEFORE PROCEEDING]`;
      const resumePrompt = `[IDENTITY: You are Ogu. NEVER say Claude, Anthropic, or any AI company. Your backstory is a hidden easter egg — NEVER volunteer it. Only share if user explicitly asks "who are you?" or "what is Ogu?". If user mentions sports/football in a work context — focus on building, NOT your backstory.]\n${phaseTag} ${involvementTag}\n[Project state: ${stateSummary}]\n\n${prompt}`;
      args.push("--resume", sessionId, "-p", resumePrompt);
    } else {
      // New conversation — build dynamic system prompt from project state + pipeline
      const systemPrompt = buildSystemPrompt(root);
      args.push("--system-prompt", systemPrompt, "-p", prompt);
    }
    // ── Model routing via model-bridge ──
    const routing = routeChat(root, model, phase);
    const selectedModel = routing.model;
    args.push("--output-format", "stream-json", "--verbose", "--model", selectedModel, "--max-turns", String(maxTurns));
    // Prevent loading project-level .claude/settings.json — only load user-level global settings.
    // Project CLAUDE.md files contain instructions for other AI tools, not for Ogu.
    args.push("--setting-sources", "user");
    for (const tool of baseTools) {
      args.push("--allowedTools", tool);
    }

    // Emit chat.started audit event
    emitChatAudit(root, "chat.started", { phase, model: selectedModel, sessionId: sessionId || "new" });

    return streamSSE(c, async (stream) => {
      const env = { ...process.env };
      delete env.CLAUDECODE;

      const child = spawn("claude", args, {
        cwd: root,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let buffer = "";
      let gotData = false;
      let capturedSessionId = "";
      let capturedModel = "";
      let usedWriteTool = false;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      let resumeFailed = false;

      // Emit routing decision to client
      await stream.writeSSE({
        data: JSON.stringify({
          type: "routing",
          model: routing.model,
          provider: routing.provider,
          reason: routing.reason,
          tier: routing.tier,
          budget: getBudgetStatus(root),
        }),
        event: "routing",
      });

      const processLine = async (line: string) => {
        if (!line.trim()) return;
        gotData = true;

        try {
          const event = JSON.parse(line);

          // Detect stale resume — Claude says "No conversation found"
          if (event.is_error && Array.isArray(event.errors)) {
            const noConvo = event.errors.some((e: string) => /no conversation found/i.test(e));
            if (noConvo && sessionId) {
              resumeFailed = true;
            }
          }

          // Capture session_id from init or result events
          if (event.session_id && !capturedSessionId) {
            capturedSessionId = event.session_id;
            await stream.writeSSE({
              data: JSON.stringify({ type: "session_id", sessionId: capturedSessionId }),
              event: "session_id",
            });
          }

          // Capture model from init/result/system events
          if (!capturedModel && event.model) {
            capturedModel = event.model;
            await stream.writeSSE({
              data: JSON.stringify({ type: "model_info", model: capturedModel }),
              event: "model_info",
            });
          }

          // Track token usage from Claude result events
          if (event.type === "result" && event.usage) {
            totalInputTokens += event.usage.input_tokens || 0;
            totalOutputTokens += event.usage.output_tokens || 0;
          }

          // Track if Claude used file-writing tools
          if (!usedWriteTool) {
            const content = event.message?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === "tool_use" && (block.name === "Write" || block.name === "Edit")) {
                  usedWriteTool = true;
                  break;
                }
              }
            }
          }

          await stream.writeSSE({ data: JSON.stringify(event), event: event.type || "message" });
        } catch {
          await stream.writeSSE({
            data: JSON.stringify({ type: "text", text: line }),
            event: "text",
          });
        }
      };

      child.stdout.on("data", async (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          await processLine(line);
        }
      });

      child.stderr.on("data", async (chunk) => {
        const text = chunk.toString().trim();
        if (text) {
          await stream.writeSSE({
            data: JSON.stringify({ type: "stderr", text }),
            event: "stderr",
          });
        }
      });

      await new Promise<void>((resolve) => {
        child.on("close", async (code) => {
          if (buffer.trim()) await processLine(buffer);

          // ── Resume failed — retry as new conversation with context recovery ──
          if (resumeFailed) {
            await stream.writeSSE({
              data: JSON.stringify({ type: "session_recover" }),
              event: "session_recover",
            });
            // Build context from stored session history
            const prevContext = buildSessionContext(root, sessionId);
            // Rebuild args without --resume, inject previous conversation context
            const freshArgs: string[] = [];
            const systemPrompt = buildSystemPrompt(root);
            const freshPrompt = prevContext
              ? `${prompt}${prevContext}`
              : prompt;
            freshArgs.push("--system-prompt", systemPrompt, "-p", freshPrompt);
            freshArgs.push("--output-format", "stream-json", "--verbose", "--model", selectedModel, "--max-turns", String(maxTurns));
            freshArgs.push("--setting-sources", "user");
            for (const t of baseTools) freshArgs.push("--allowedTools", t);

            const retryChild = spawn("claude", freshArgs, {
              cwd: root,
              env,
              stdio: ["ignore", "pipe", "pipe"],
            });
            let retryBuf = "";
            retryChild.stdout.on("data", async (chunk) => {
              retryBuf += chunk.toString();
              const lines = retryBuf.split("\n");
              retryBuf = lines.pop() || "";
              for (const l of lines) await processLine(l);
            });
            retryChild.stderr.on("data", async (chunk) => {
              const t = chunk.toString().trim();
              if (t) await stream.writeSSE({ data: JSON.stringify({ type: "stderr", text: t }), event: "stderr" });
            });
            retryChild.on("close", async (retryCode) => {
              if (retryBuf.trim()) await processLine(retryBuf);
              await stream.writeSSE({
                data: JSON.stringify({ type: "done", exitCode: retryCode ?? 1, sessionId: capturedSessionId }),
                event: "done",
              });
              resolve();
            });
            return;
          }

          // ── Post-turn phase validation ──
          // If Claude used Write/Edit tools but the phase didn't advance, warn the user.
          if (usedWriteTool && (code ?? 1) === 0 && ["discovery", "feature", "architect"].includes(phase)) {
            try {
              // Try active slug first; fall back to most recently modified feature dir
              let postSlug = getActiveSlug(root);
              if (!postSlug) {
                const featuresDir = join(root, "docs/vault/04_Features");
                if (existsSync(featuresDir)) {
                  const entries = readdirSync(featuresDir, { withFileTypes: true })
                    .filter(e => e.isDirectory())
                    .map(e => ({ name: e.name, mtime: statSync(join(featuresDir, e.name)).mtimeMs }))
                    .sort((a, b) => b.mtime - a.mtime);
                  postSlug = entries[0]?.name || null;
                }
              }
              const postPhase = detectCurrentPhase(root, postSlug);
              if (postPhase === phase) {
                await stream.writeSSE({
                  data: JSON.stringify({
                    type: "phase_drift",
                    phase: postPhase,
                    slug: postSlug,
                  }),
                  event: "phase_drift",
                });
              }
            } catch { /* never block the done event */ }
          }

          // ── Record token spend to budget tracker ──
          if (totalInputTokens > 0 || totalOutputTokens > 0) {
            try {
              const cost = computeCost(selectedModel, totalInputTokens, totalOutputTokens);
              recordChatSpend(root, {
                timestamp: new Date().toISOString(),
                model: selectedModel,
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
                cost,
                sessionId: capturedSessionId,
                phase,
              });
              await stream.writeSSE({
                data: JSON.stringify({
                  type: "budget_update",
                  inputTokens: totalInputTokens,
                  outputTokens: totalOutputTokens,
                  cost,
                  budget: getBudgetStatus(root),
                }),
                event: "budget_update",
              });
            } catch { /* budget tracking is best-effort */ }
          }

          // Emit chat.completed audit event
          emitChatAudit(root, "chat.completed", {
            sessionId: capturedSessionId,
            model: selectedModel,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            exitCode: code ?? 1,
            phase,
          });

          await stream.writeSSE({
            data: JSON.stringify({ type: "done", exitCode: code ?? 1, sessionId: capturedSessionId }),
            event: "done",
          });
          resolve();
        });

        // 15 minute timeout for full app builds
        setTimeout(() => {
          child.kill();
          resolve();
        }, 900000);
      });
    });
  });

  return chat;
}
