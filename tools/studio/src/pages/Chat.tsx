import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { YStack, XStack, Text, ScrollView } from "tamagui";
import { parseChat, extractUrls, type ParseResult } from "@/lib/chat-parser";
import { FileTreePanel } from "@/components/file-tree/FileTree";
import { useStore } from "@/lib/store";
import { Icon, icons } from "@/lib/icons";
import oguAscii from "@/assets/ogu-ascii.txt?raw";

interface UploadedImage {
  name: string;
  base64: string;
  path: string;
}

/* ── RTL/LTR detection ── */
const RTL_REGEX = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/;
function detectDir(text: string): "rtl" | "ltr" {
  const cleaned = text.replace(/^[\s>⚡✓✗·•\-—!$⏺⎿]+/, "");
  return RTL_REGEX.test(cleaned) ? "rtl" : "ltr";
}

const HE_REGEX = /[\u0590-\u05FF]/;
const AR_REGEX = /[\u0600-\u06FF]/;
function detectLang(text: string): string {
  if (HE_REGEX.test(text)) return "he";
  if (AR_REGEX.test(text)) return "ar";
  return "en";
}

interface InvolvementLevel {
  label: string;
  description: string;
  value: string; // sent back to Claude
}

interface Line {
  id: string;
  type: "prompt" | "reply" | "output" | "status" | "error" | "tool" | "tool-result" | "meta" | "choices" | "phase" | "step" | "heading" | "spacer" | "involvement" | "diff" | "ascii-art" | "url-action";
  text: string;
  dir?: "rtl" | "ltr";
  ts?: number;
  choices?: string[];
  urls?: string[];
  involvementLevels?: InvolvementLevel[];
  diffType?: "context" | "add" | "remove" | "summary";
}

interface Session {
  id: string;
  label: string;
  type: "ogu" | "shell";
  lines: Line[];
  loading: boolean;
  claudeSessionId?: string;
}

/** Parse model ID like "claude-sonnet-4-6-20250514" → "Claude Sonnet 4.6" */
function formatModelName(modelId: string): string {
  const m = modelId.match(/claude-(\w+)-(\d+)-(\d+)/);
  if (!m) return modelId;
  const name = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  return `Claude ${name} ${m[2]}.${m[3]}`;
}

const thinkingVerbs = [
  "Brewing", "Crafting", "Weaving", "Conjuring", "Forging",
  "Assembling", "Sculpting", "Composing", "Cooking", "Sketching",
  "Wiring", "Spinning", "Mixing", "Plotting", "Shaping",
];
const pickVerb = () => thinkingVerbs[Math.floor(Math.random() * thinkingVerbs.length)];

/** Generate diff lines from Edit tool input */
function buildDiffLines(input: any): Line[] {
  if (!input?.old_string || !input?.new_string) return [];
  const oldLines = input.old_string.split("\n");
  const newLines = input.new_string.split("\n");
  const added = newLines.length;
  const removed = oldLines.length;
  const lines: Line[] = [];

  // Summary
  const parts: string[] = [];
  if (added > removed) parts.push(`+${added - removed}`);
  else if (removed > added) parts.push(`-${removed - added}`);
  else parts.push("~" + added);
  lines.push({ id: uid(), type: "diff", text: `    ⎿  ${parts.join(", ")} lines`, diffType: "summary" });

  // Show up to 10 lines total
  const maxPerSide = 5;
  for (const l of oldLines.slice(0, maxPerSide)) {
    lines.push({ id: uid(), type: "diff", text: `      ${l}`, diffType: "remove" });
  }
  if (oldLines.length > maxPerSide) {
    lines.push({ id: uid(), type: "diff", text: `      ... +${oldLines.length - maxPerSide} more`, diffType: "remove" });
  }
  for (const l of newLines.slice(0, maxPerSide)) {
    lines.push({ id: uid(), type: "diff", text: `      ${l}`, diffType: "add" });
  }
  if (newLines.length > maxPerSide) {
    lines.push({ id: uid(), type: "diff", text: `      ... +${newLines.length - maxPerSide} more`, diffType: "add" });
  }

  return lines;
}

let _id = 0;
const uid = () => `l-${++_id}`;
let _sid = 0;
const newSid = () => `s-${++_sid}`;

const INVOLVEMENT_I18N: Record<string, { title: string; explanation: string[]; levels: InvolvementLevel[] }> = {
  he: {
    title: "לפני שנמשיך, איך תרצה לעבוד?",
    explanation: [
      "טייס אוטומטי - אתה מתאר את הרעיון, אוגו מטפל בהכל מההתחלה עד הסוף.",
      "הכוונה קלה - אוגו מוביל את התהליך, אתה מכריע בנקודות מפתח.",
      "מוצר מוביל - אתה מגדיר את המוצר והפיצ׳רים, אוגו בונה.",
      "שיתוף פעולה מלא - כל החלטה עוברת דרכך, עובדים ביחד צעד אחרי צעד.",
    ],
    levels: [
      { label: "טייס אוטומטי", description: "אני מתאר, אוגו עושה הכל.", value: "autopilot" },
      { label: "הכוונה קלה", description: "אוגו מוביל, אני מכריע בנקודות מפתח.", value: "guided" },
      { label: "מוצר מוביל", description: "אני מגדיר את המוצר, אוגו בונה.", value: "product-focused" },
      { label: "שיתוף פעולה מלא", description: "כל החלטה עוברת דרכי.", value: "hands-on" },
    ],
  },
  ar: {
    title: "قبل أن نكمل، كيف تريد العمل؟",
    explanation: [
      "طيار آلي - تصف الفكرة، أوغو يتولى كل شيء من البداية للنهاية.",
      "توجيه خفيف - أوغو يقود العملية، أنت تقرر في النقاط المهمة.",
      "تركيز على المنتج - أنت تحدد المنتج والميزات، أوغو يبني.",
      "تعاون كامل - كل قرار يمر من خلالك، نعمل معا خطوة بخطوة.",
    ],
    levels: [
      { label: "طيار آلي", description: "أنا أصف، أوغو يتولى كل شيء.", value: "autopilot" },
      { label: "توجيه خفيف", description: "أوغو يقود، أنا أقرر في النقاط المهمة.", value: "guided" },
      { label: "تركيز على المنتج", description: "أنا أحدد المنتج، أوغو يبني.", value: "product-focused" },
      { label: "تعاون كامل", description: "كل قرار يمر من خلالي.", value: "hands-on" },
    ],
  },
  en: {
    title: "Before we continue, how would you like to work?",
    explanation: [
      "Full Autopilot - You describe the idea, Ogu handles everything from start to finish.",
      "Light Guidance - Ogu leads the process, you make the key calls.",
      "Product Focused - You define the product and features, Ogu builds.",
      "Deep Collaboration - Every decision goes through you, we work step by step together.",
    ],
    levels: [
      { label: "Full Autopilot", description: "I describe, Ogu handles everything.", value: "autopilot" },
      { label: "Light Guidance", description: "Ogu leads, I weigh in on key calls.", value: "guided" },
      { label: "Product Focused", description: "I define the product, Ogu builds.", value: "product-focused" },
      { label: "Deep Collaboration", description: "Every decision goes through me.", value: "hands-on" },
    ],
  },
};

function getInvolvementForLang(lang: string) {
  return INVOLVEMENT_I18N[lang] || INVOLVEMENT_I18N.en;
}

function sessionsKey(root: string) { return `ogu-sessions:${root}`; }
function activeKey(root: string) { return `ogu-active:${root}`; }

function loadSessions(root: string): { sessions: Session[]; activeId: string } | null {
  try {
    const raw = localStorage.getItem(sessionsKey(root));
    if (!raw) return null;
    const saved: Session[] = JSON.parse(raw);
    if (!Array.isArray(saved) || saved.length === 0) return null;
    // Reset loading state and sync counters
    for (const s of saved) {
      s.loading = false;
      const sidNum = parseInt(s.id.replace("s-", ""), 10);
      if (sidNum > _sid) _sid = sidNum;
      for (const l of s.lines) {
        const lidNum = parseInt(l.id.replace("l-", ""), 10);
        if (lidNum > _id) _id = lidNum;
      }
    }
    const activeId = localStorage.getItem(activeKey(root)) || saved[0].id;
    return { sessions: saved, activeId };
  } catch { return null; }
}

function saveSessions(root: string, sessions: Session[], activeId: string) {
  try {
    // Don't persist loading state or very long sessions (trim to last 500 lines)
    const toSave = sessions.map((s) => ({
      ...s,
      loading: false,
      lines: s.lines.length > 500 ? s.lines.slice(-500) : s.lines,
    }));
    localStorage.setItem(sessionsKey(root), JSON.stringify(toSave));
    localStorage.setItem(activeKey(root), activeId);
  } catch { /* storage full — ignore */ }
}

function createOguSession(): Session {
  return {
    id: newSid(), label: "Ogu", type: "ogu", loading: false,
    lines: [
      { id: uid(), type: "reply", text: "⚡ Ogu — from idea to production, on autopilot." },
      { id: uid(), type: "status", text: "   Describe what you want to build. Ogu handles the rest." },
    ],
  };
}

function createShellSession(n: number): Session {
  return {
    id: newSid(), label: `zsh${n > 1 ? " " + n : ""}`, type: "shell", loading: false,
    lines: [{ id: uid(), type: "status", text: `$ shell session opened` }],
  };
}

const ASCII_CHARS = [" ", ".", "+", "=", "*", "#", "%", "@"];

function AsciiArtBlock({ text }: { text: string }) {
  const [frame, setFrame] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setFrame((f) => f + 1), 200);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const transformed = useMemo(() => {
    return text.split("").map((ch, i) => {
      const rank = ASCII_CHARS.indexOf(ch);
      if (rank <= 0) return ch; // spaces and non-art chars stay
      const shifted = (rank + Math.floor((frame + i * 0.3) % 3)) % ASCII_CHARS.length;
      return ASCII_CHARS[Math.max(1, shifted)] || ch;
    }).join("");
  }, [text, frame]);

  return (
    <pre style={{
      fontFamily: "var(--font-mono)", fontSize: 3, lineHeight: "3.5px",
      color: "var(--text)", whiteSpace: "pre",
      margin: 0, userSelect: "none", fontWeight: 700,
    }}>{transformed}</pre>
  );
}

export function Chat() {
  const projectRoot = useStore((s) => s.projectRoot);

  const [sessions, setSessions] = useState<Session[]>(() => {
    const loaded = loadSessions(projectRoot);
    return loaded ? loaded.sessions : [createOguSession()];
  });
  const [activeId, setActiveId] = useState(() => {
    const loaded = loadSessions(projectRoot);
    return loaded?.activeId || "s-1";
  });

  // Reset sessions when project changes
  const prevRootRef = useRef(projectRoot);
  useEffect(() => {
    if (prevRootRef.current !== projectRoot && projectRoot) {
      prevRootRef.current = projectRoot;
      const loaded = loadSessions(projectRoot);
      if (loaded) {
        setSessions(loaded.sessions);
        setActiveId(loaded.activeId);
      } else {
        const s = createOguSession();
        setSessions([s]);
        setActiveId(s.id);
      }
    }
  }, [projectRoot]);
  const [input, setInput] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [quotedText, setQuotedText] = useState<string | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [currentModel, setCurrentModel] = useState<string>(() => {
    try { return localStorage.getItem("ogu-model") || "sonnet"; } catch { return "sonnet"; }
  });
  const [resolvedModel, setResolvedModel] = useState<string>("");
  const [thinkingVerb, setThinkingVerb] = useState(pickVerb);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, Set<number>>>({}); // lineId → selected indices
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({}); // lineId → selected index
  const [pendingMessage, setPendingMessage] = useState<string | null>(null); // first message waiting for involvement level
  const scrollRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shellCountRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const savedInputRef = useRef("");
  const lastPromptDirRef = useRef<"rtl" | "ltr">("ltr");
  const lastPromptLangRef = useRef<string>("en");

  const active = sessions.find((s) => s.id === activeId) || sessions[0];

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 30);
  }, [active.lines.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeId]);

  // Persist sessions to localStorage (per project)
  useEffect(() => {
    if (projectRoot) saveSessions(projectRoot, sessions, activeId);
  }, [sessions, activeId, projectRoot]);

  // Persist model preference
  useEffect(() => {
    try { localStorage.setItem("ogu-model", currentModel); } catch {}
  }, [currentModel]);

  // Close model menu on outside click
  useEffect(() => {
    if (!modelMenuOpen) return;
    const handler = () => setModelMenuOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [modelMenuOpen]);

  function stopCurrent() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setSessionLoading(active.id, false);
    appendLine(active.id, { id: uid(), type: "error", text: "  ⏹ Interrupted" });
  }

  function newChat() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setSessionLoading(active.id, false);
    const s = createOguSession();
    setSessions((prev) => [...prev, s]);
    setActiveId(s.id);
  }

  /* ── Session helpers ── */
  const updateSession = useCallback((id: string, fn: (s: Session) => Session) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? fn(s) : s)));
  }, []);

  const appendLines = useCallback((id: string, newLines: Line[]) => {
    updateSession(id, (s) => ({ ...s, lines: [...s.lines, ...newLines] }));
  }, [updateSession]);

  const appendLine = useCallback((id: string, line: Line) => {
    updateSession(id, (s) => ({ ...s, lines: [...s.lines, line] }));
  }, [updateSession]);

  const setSessionLoading = useCallback((id: string, loading: boolean) => {
    updateSession(id, (s) => ({ ...s, loading }));
  }, [updateSession]);

  function addShell() {
    shellCountRef.current++;
    const s = createShellSession(shellCountRef.current);
    setSessions((prev) => [...prev, s]);
    setActiveId(s.id);
  }

  function closeSession(id: string) {
    if (sessions.length <= 1) {
      // Last session — replace with a fresh one
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setSessionLoading(id, false);
      const fresh = createOguSession();
      setSessions([fresh]);
      setActiveId(fresh.id);
      return;
    }

    setSessions((prev) => {
      const next = prev.filter((x) => x.id !== id);
      if (activeId === id) {
        setActiveId(next[0].id);
      }
      return next;
    });
  }

  function startRename(id: string) {
    const s = sessions.find((x) => x.id === id);
    if (!s) return;
    setRenamingId(id);
    setRenameValue(s.label);
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      updateSession(renamingId, (s) => ({ ...s, label: renameValue.trim() }));
    }
    setRenamingId(null);
    setRenameValue("");
  }

  /* ── Quote a message ── */
  function quoteText(text: string) {
    const clean = text.replace(/^\s+/, "").slice(0, 200);
    setQuotedText(clean);
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  /* ── Image upload ── */
  async function uploadFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length) return;

    setUploading(true);
    for (const file of imageFiles) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) {
          appendLine(active.id, { id: uid(), type: "error", text: `  Upload failed: ${res.status} ${res.statusText}` });
          continue;
        }
        const data = await res.json();
        setImages((prev) => [...prev, { name: data.name, base64: data.base64, path: data.path }]);
      } catch (err: any) {
        appendLine(active.id, { id: uid(), type: "error", text: `  Upload error: ${err.message}` });
      }
    }
    setUploading(false);
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }

  /* ── Shell command execution ── */
  async function runShell(sid: string, cmd: string) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSessionLoading(sid, true);
    appendLine(sid, { id: uid(), type: "status", text: `  $ ${cmd}` });

    try {
      const res = await fetch("/api/shell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      const output = data.stdout?.trim() || data.stderr?.trim() || "(no output)";
      const ok = data.exitCode === 0;

      appendLines(sid, [
        ...output.split("\n").map((l: string) => ({ id: uid(), type: "output" as const, text: `  ${l}`, dir: detectDir(l) })),
        ...(data.stderr?.trim() && data.stdout?.trim()
          ? data.stderr.trim().split("\n").map((l: string) => ({ id: uid(), type: "error" as const, text: `  ${l}` }))
          : []),
        { id: uid(), type: ok ? "status" as const : "error" as const, text: ok ? "  ✓ Done" : `  ✗ Exit code ${data.exitCode}` },

      ]);
    } catch (err: any) {
      appendLines(sid, [
        { id: uid(), type: "error", text: `  Error: ${err.message}` },

      ]);
    }
    setSessionLoading(sid, false);
  }

  /* ── Ogu CLI command execution ── */
  async function runOguCommand(sid: string, command: string, args: string[], description: string) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSessionLoading(sid, true);
    appendLine(sid, { id: uid(), type: "status", text: `  ⚡ ${description}` });

    try {
      const res = await fetch("/api/command/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, args }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      const output = data.stdout?.trim() || "(no output)";
      const ok = data.exitCode === 0;

      appendLines(sid, [
        ...output.split("\n").map((l: string) => ({ id: uid(), type: "output" as const, text: `  ${l}`, dir: detectDir(l) })),
        { id: uid(), type: ok ? "status" as const : "error" as const, text: ok ? "  ✓ Done" : `  ✗ Exit code ${data.exitCode}` },

      ]);
    } catch (err: any) {
      appendLines(sid, [
        { id: uid(), type: "error", text: `  Error: ${err.message}` },

      ]);
    }
    setSessionLoading(sid, false);
  }

  /* ── Claude streaming chat (persistent sessions via --resume) ── */
  async function chatWithClaude(sid: string, message: string) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSessionLoading(sid, true);
    setThinkingVerb(pickVerb());

    const session = sessions.find((s) => s.id === sid);
    const claudeSessionId = session?.claudeSessionId;
    const startTime = Date.now();
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          sessionId: claudeSessionId,
          model: currentModel,
          images: images.length > 0 ? images.map((img) => img.path) : undefined,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";

      const processEvent = (event: any) => {
        // Capture session_id for --resume
        if (event.type === "session_id" && event.sessionId) {
          updateSession(sid, (s) => ({ ...s, claudeSessionId: event.sessionId }));
        }
        if (event.type === "done" && event.sessionId) {
          updateSession(sid, (s) => ({ ...s, claudeSessionId: s.claudeSessionId || event.sessionId }));
        }
        // Server forced involvement slider — save original message as pending
        if (event.type === "needs_involvement") {
          setPendingMessage(message);
        }
        // Capture token usage
        if (event.usage) {
          inputTokens = event.usage.input_tokens || inputTokens;
          outputTokens = event.usage.output_tokens || outputTokens;
          totalTokens = inputTokens + outputTokens;
        }
        if (event.total_cost_usd) costUsd = event.total_cost_usd;
        if (event.cost_usd) costUsd = event.cost_usd;
        handleStreamEvent(sid, event);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const bufLines = sseBuffer.split("\n");
        sseBuffer = bufLines.pop() || "";

        for (const line of bufLines) {
          if (line.startsWith("data:")) {
            const raw = line.slice(5).trim();
            if (!raw) continue;
            try { processEvent(JSON.parse(raw)); } catch { /* skip */ }
          }
        }
      }

      if (sseBuffer.trim().startsWith("data:")) {
        try { processEvent(JSON.parse(sseBuffer.trim().slice(5).trim())); } catch { /* ignore */ }
      }

      // Add stats line after response
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const parts: string[] = [`${elapsed}s`];
      if (totalTokens > 0) parts.push(`${totalTokens.toLocaleString()} tokens`);
      if (costUsd > 0) parts.push(`$${costUsd.toFixed(4)}`);
      appendLine(sid, { id: uid(), type: "meta", text: `  ${parts.join(" · ")}`, ts: Date.now() });
    } catch (err: any) {
      // Don't show error for intentional aborts (Esc / interrupt)
      if (err.name === "AbortError" || ctrl.signal.aborted) {
        // Silently ignore — user interrupted
      } else {
        appendLines(sid, [
          { id: uid(), type: "error", text: `  Could not reach Claude: ${err.message}` },
          { id: uid(), type: "status", text: "  Tip: make sure 'claude' CLI is installed and authenticated." },
        ]);
      }
    }
    // Only clear loading if this controller is still the active one
    if (abortRef.current === ctrl) {
      setSessionLoading(sid, false);
    }
  }

  // Phase markers: "📋 Discovery", "🎯 Plan", "🔨 Build", "✅ Done"
  const PHASE_REGEX = /^(📋\s*Discovery|🎯\s*Plan|🔨\s*Build(?:ing)?|✅\s*Done|✅\s*Deliver)/i;
  // Step markers: "📁 Creating...", "🎨 Building...", "⚡ Adding...", "🔧 Setting up...", "📱 Making..."
  const STEP_REGEX = /^(📁|🎨|⚡|🔧|📱|🔄|📦|🧪|🚀|💾|🎯|✏️)\s+/;

  // Strip markdown formatting for clean display
  function cleanMarkdown(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, "$1")  // **bold** -> bold
      .replace(/\*(.+?)\*/g, "$1")      // *italic* -> italic
      .replace(/`(.+?)`/g, "$1")        // `code` -> code
      .replace(/^#{1,6}\s+/gm, "")      // ### heading -> heading
      .replace(/^>\s?/gm, "")           // > blockquote -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // [link](url) -> link
  }

  const oguAsciiShownRef = useRef<Set<string>>(new Set());
  const involvementShownRef = useRef<Set<string>>(new Set());

  function appendReplyLines(sid: string, text: string) {
    // If response mentions John Ogu — show ASCII art once per session
    const OGU_KEYWORDS = [/ג׳ון אוגו/i, /john ogu/i, /אוגו משוגע/i, /ogu meshuga/i, /אוגו\? כן נותן/i, /197 הופעות/i, /John Ugochukwu/i, /הפועל באר שבע/i, /hapoel beer sheva/i, /שער האליפות/i, /אליפויות/i, /18 שערים/i, /14 בישולים/i];
    const oguHits = OGU_KEYWORDS.filter((r) => r.test(text)).length;
    if (oguHits >= 2 && !oguAsciiShownRef.current.has(sid)) {
      oguAsciiShownRef.current.add(sid);
      appendLine(sid, { id: uid(), type: "ascii-art", text: oguAscii });
      appendLine(sid, { id: uid(), type: "spacer", text: "" });
    }

    // Check for involvement slider pattern: ?involvement\nlabel|description|value\n...
    const involvementMatch = text.match(/\?involvement\n((?:.*\|.*\|.*\n?)+)/);
    if (involvementMatch && !involvementShownRef.current.has(sid)) {
      involvementShownRef.current.add(sid);
      // Parse everything before the ?involvement marker as normal text
      const beforeMarker = text.slice(0, text.indexOf("?involvement")).trim();
      if (beforeMarker) {
        appendReplyLines(sid, beforeMarker);
      }
      // Parse involvement levels
      const levelLines = involvementMatch[1].trim().split("\n").filter(Boolean);
      const levels: InvolvementLevel[] = levelLines.map((line) => {
        const [label, description, value] = line.split("|").map((s) => s.trim());
        return { label: label || "", description: description || "", value: value || label || "" };
      });
      if (levels.length >= 2) {
        appendLine(sid, { id: uid(), type: "involvement", text: "", involvementLevels: levels });
      }
      // Parse everything after the involvement block as normal text
      const afterBlock = text.slice(text.indexOf("?involvement") + involvementMatch[0].length).trim();
      if (afterBlock) {
        appendReplyLines(sid, afterBlock);
      }
      return;
    }

    // Check for ?select pattern: ?select\nQuestion?\nlabel|description|value\n...
    // Renders as choice buttons with descriptions (richer than plain bullet lists)
    const selectMatch = text.match(/\?select\n([^\n]*\?[^\n]*)\n((?:.*\|.*\n?)+)/);
    if (selectMatch) {
      // Parse everything before ?select as normal text
      const beforeSelect = text.slice(0, text.indexOf("?select")).trim();
      if (beforeSelect) {
        appendReplyLines(sid, beforeSelect);
      }
      // Emit the question line
      const question = selectMatch[1].trim();
      appendLine(sid, { id: uid(), type: "reply", text: cleanMarkdown(question), dir: detectDir(question) === "rtl" ? "rtl" : lastPromptDirRef.current });
      // Parse pipe-delimited options into bullet-style choices for the existing renderer
      const optLines = selectMatch[2].trim().split("\n").filter(Boolean);
      const choiceLabels = optLines.map((line) => {
        const parts = line.split("|").map((s) => s.trim());
        // Format as "Label - Description" for the choice button
        if (parts[1]) return `- **${parts[0]}** - ${parts[1]}`;
        return `- ${parts[0]}`;
      });
      if (choiceLabels.length >= 2) {
        appendLine(sid, { id: uid(), type: "choices", text: "", choices: choiceLabels });
      }
      // Parse everything after the select block as normal text
      const afterSelect = text.slice(text.indexOf("?select") + selectMatch[0].length).trim();
      if (afterSelect) {
        appendReplyLines(sid, afterSelect);
      }
      return;
    }

    // Pre-process: remove code fences (``` lines) and --- separators, keep blank lines as spacers
    const rawLines = text.split("\n");
    const processed: (string | null)[] = []; // null = spacer
    let inCodeBlock = false;
    for (const l of rawLines) {
      const trimmed = l.trim();
      if (trimmed.startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
        continue;
      }
      if (!trimmed) {
        // Skip blank lines — no spacer divs between lines
        continue;
      }
      processed.push(l);
    }

    // Detect direction at the MESSAGE level
    const messageDir = detectDir(text) === "rtl" ? "rtl" : lastPromptDirRef.current;
    const optionRegex = /^(\d+\.\s+|- \*\*|- [^\s*]|\* \*\*|[•·]\s)/;
    const MAX_OPTION_LEN = 200;
    let optionBatch: string[] = [];
    let lastLineWasQuestion = false;
    const HEADING_REGEX = /^#{1,6}\s+/;

    const isOption = (trimmed: string) => {
      if (!optionRegex.test(trimmed)) return false;
      const clean = trimmed.replace(/\*\*/g, "").replace(/^[•·-]\s*/, "").replace(/^\d+\.\s+/, "").trim();
      return clean.length <= MAX_OPTION_LEN;
    };

    const flushOptions = () => {
      if (optionBatch.length >= 2 && lastLineWasQuestion) {
        appendLine(sid, { id: uid(), type: "choices", text: "", choices: optionBatch });
      } else {
        for (const o of optionBatch) {
          const clean = cleanMarkdown(o);
          appendLine(sid, { id: uid(), type: "reply", text: clean, dir: messageDir });
        }
      }
      optionBatch = [];
    };

    for (const item of processed) {
      if (item === null) {
        // Spacer between sections
        if (optionBatch.length > 0) flushOptions();
        appendLine(sid, { id: uid(), type: "spacer", text: "" });
        continue;
      }
      const trimmed = item.trim();
      if (isOption(trimmed)) {
        optionBatch.push(trimmed);
      } else if (PHASE_REGEX.test(trimmed)) {
        if (optionBatch.length > 0) flushOptions();
        appendLine(sid, { id: uid(), type: "phase", text: cleanMarkdown(trimmed), dir: messageDir });
      } else if (STEP_REGEX.test(trimmed)) {
        if (optionBatch.length > 0) flushOptions();
        appendLine(sid, { id: uid(), type: "step", text: cleanMarkdown(trimmed), dir: messageDir });
      } else if (HEADING_REGEX.test(trimmed)) {
        if (optionBatch.length > 0) flushOptions();
        const clean = trimmed.replace(HEADING_REGEX, "").replace(/\*\*/g, "");
        appendLine(sid, { id: uid(), type: "heading", text: clean, dir: messageDir });
      } else {
        if (optionBatch.length > 0) flushOptions();
        const clean = cleanMarkdown(item);
        appendLine(sid, { id: uid(), type: "reply", text: clean, dir: messageDir });
        lastLineWasQuestion = trimmed.endsWith("?") || trimmed.endsWith("?**");
      }
    }
    if (optionBatch.length > 0) flushOptions();
  }

  function handleStreamEvent(sid: string, event: any) {
    switch (event.type) {
      case "assistant": {
        const content = event.message?.content;
        if (typeof content === "string" && content.trim()) {
          appendReplyLines(sid, content);
        }
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text?.trim()) {
              appendReplyLines(sid, block.text);
            }
            if (block.type === "tool_use") {
              const display = formatToolDisplay(block.name, block.input);
              const detail = formatToolInput(block.name, block.input);
              appendLine(sid, { id: uid(), type: "tool", text: `  ⏺   ${display}${detail ? ` → ${detail}` : ""}` });
              if (block.name === "Edit" && block.input) {
                const diffLines = buildDiffLines(block.input);
                if (diffLines.length) appendLines(sid, diffLines);
              }
            }
          }
        }
        break;
      }
      case "content_block_start":
      case "content_block_delta": {
        const block = event.content_block || event.delta;
        if ((block?.type === "text_delta" || block?.type === "text") && block.text?.trim()) {
          const chunkDir = detectDir(block.text) === "rtl" ? "rtl" : lastPromptDirRef.current;
          for (const l of block.text.split("\n")) {
            if (l.trim()) appendLine(sid, { id: uid(), type: "reply", text: l.trim(), dir: chunkDir });
          }
        }
        if (block?.type === "tool_use") {
          const display = formatToolDisplay(block.name, block.input);
          appendLine(sid, { id: uid(), type: "tool", text: `  ⏺   ${display}...` });
        }
        break;
      }
      case "tool_use": {
        const name = event.name || event.tool?.name || "tool";
        const inp = event.input || event.tool?.input;
        const display = formatToolDisplay(name, inp);
        const detail = formatToolInput(name, inp);
        appendLine(sid, { id: uid(), type: "tool", text: `  ⏺   ${display}${detail ? ` → ${detail}` : ""}` });
        if (name === "Edit" && inp) {
          const diffLines = buildDiffLines(inp);
          if (diffLines.length) appendLines(sid, diffLines);
        }
        break;
      }
      case "tool_result": {
        const text = typeof (event.output || event.content) === "string" ? (event.output || event.content) : JSON.stringify(event.output || event.content || "");
        const trLines = text.split("\n").slice(0, 8);
        for (const l of trLines) appendLine(sid, { id: uid(), type: "tool-result", text: `    ⎿ ${l}` });
        if (text.split("\n").length > 8) appendLine(sid, { id: uid(), type: "tool-result", text: `    ⎿ ... (${text.split("\n").length - 8} more lines)` });
        break;
      }
      case "result": {
        // Skip — text already shown via "assistant" event. Only usage/cost data is captured above.
        break;
      }
      case "text":
        if (event.text?.trim()) {
          const tDir = detectDir(event.text) === "rtl" ? "rtl" : lastPromptDirRef.current;
          for (const l of event.text.split("\n")) { if (l.trim()) appendLine(sid, { id: uid(), type: "reply", text: l.trim(), dir: tDir }); }
        }
        break;
      case "needs_involvement": {
        if (involvementShownRef.current.has(sid)) break; // already shown
        involvementShownRef.current.add(sid);
        const lang = lastPromptLangRef.current;
        const i18n = getInvolvementForLang(lang);
        const dir = lang === "he" || lang === "ar" ? "rtl" : "ltr";
        // Title as normal reply message
        appendLine(sid, { id: uid(), type: "reply", text: i18n.title, dir });
        // Explanation lines as normal reply messages
        for (const line of i18n.explanation) {
          appendLine(sid, { id: uid(), type: "reply", text: line, dir });
        }
        // Then the slider widget underneath
        appendLine(sid, {
          id: uid(),
          type: "involvement",
          text: "",
          involvementLevels: i18n.levels,
        });
        break;
      }
      case "phase_blocked": {
        const phase = event.currentPhase || "unknown";
        const reason = event.reason || "Pipeline phase violation.";
        const missing = event.missingFiles;
        appendLine(sid, { id: uid(), type: "error", text: `  Pipeline blocked (current phase: ${phase})` });
        appendLine(sid, { id: uid(), type: "reply", text: reason });
        if (missing && missing.length > 0) {
          appendLine(sid, { id: uid(), type: "status", text: `  Missing: ${missing.join(", ")}` });
        }
        appendLine(sid, { id: uid(), type: "status", text: "  Follow the pipeline: Discovery -> Feature -> Architect -> Preflight -> Build -> Gates -> Deliver" });
        break;
      }
      case "phase_drift": {
        const driftPhase = event.phase || "unknown";
        appendLine(sid, { id: uid(), type: "error", text: `  Phase "${driftPhase}" did not advance. Expected files may not have been written to disk.` });
        break;
      }
      case "model_info":
        if (event.model) setResolvedModel(event.model);
        break;
      case "session_id": case "system": case "done": case "stderr": case "rate_limit_event": break;
      default:
        if (event.text?.trim()) {
          const dDir = detectDir(event.text) === "rtl" ? "rtl" : lastPromptDirRef.current;
          for (const l of event.text.split("\n")) { if (l.trim()) appendLine(sid, { id: uid(), type: "reply", text: l.trim(), dir: dDir }); }
        }
    }
  }

  function formatToolInput(name: string, input: any): string {
    if (!input) return "";
    if (typeof input === "string") return input;
    if (name === "Write" && input.file_path) return input.file_path.split("/").pop() || "";
    if (name === "Bash") return ""; // display function handles description
    if (name === "Read" && input.file_path) return input.file_path.split("/").pop() || "";
    if (name === "Edit" && input.file_path) return input.file_path.split("/").pop() || "";
    if (name === "Grep" && input.pattern) return `"${input.pattern}"`;
    if (name === "Glob" && input.pattern) return input.pattern;
    return "";
  }

  function describeBashCommand(cmd: string): string {
    const c = cmd.trim();
    // File operations
    if (c.startsWith("cat ")) return `Reading ${c.split(/\s+/)[1]?.split("/").pop() || "file"}`;
    if (c.startsWith("ls")) return "Listing files";
    if (c.startsWith("mkdir")) return "Creating directory";
    if (c.startsWith("rm ")) return "Removing files";
    if (c.startsWith("cp ")) return "Copying files";
    if (c.startsWith("mv ")) return "Moving files";
    if (c.startsWith("touch ")) return "Creating file";
    if (c.startsWith("chmod")) return "Changing permissions";
    // Package managers
    if (c.startsWith("npm install") || c.startsWith("npm i ")) return "Installing dependencies";
    if (c.startsWith("npm run")) return `Running ${c.split(/\s+/).slice(0, 3).join(" ")}`;
    if (c.startsWith("npm") || c.startsWith("npx")) return `Running ${c.split(/\s+/).slice(0, 3).join(" ")}`;
    if (c.startsWith("bun install") || c.startsWith("bun i ")) return "Installing dependencies";
    if (c.startsWith("bun ")) return `Running ${c.split(/\s+/).slice(0, 3).join(" ")}`;
    if (c.startsWith("yarn")) return `Running ${c.split(/\s+/).slice(0, 3).join(" ")}`;
    if (c.startsWith("pnpm")) return `Running ${c.split(/\s+/).slice(0, 3).join(" ")}`;
    // Git
    if (c.startsWith("git status")) return "Checking git status";
    if (c.startsWith("git diff")) return "Checking changes";
    if (c.startsWith("git log")) return "Viewing git history";
    if (c.startsWith("git add")) return "Staging changes";
    if (c.startsWith("git commit")) return "Committing changes";
    if (c.startsWith("git push")) return "Pushing to remote";
    if (c.startsWith("git pull")) return "Pulling from remote";
    if (c.startsWith("git checkout") || c.startsWith("git switch")) return "Switching branch";
    if (c.startsWith("git clone")) return "Cloning repository";
    if (c.startsWith("git branch")) return "Managing branches";
    if (c.startsWith("git stash")) return "Stashing changes";
    if (c.startsWith("git merge")) return "Merging branches";
    if (c.startsWith("git rebase")) return "Rebasing branch";
    if (c.startsWith("git fetch")) return "Fetching from remote";
    if (c.startsWith("git")) return "Running git operation";
    // Build & test
    if (c.includes("tsc")) return "Type-checking";
    if (c.includes("eslint") || c.includes("lint")) return "Linting code";
    if (c.includes("prettier") || c.includes("format")) return "Formatting code";
    if (c.includes("jest") || c.includes("vitest") || c.includes("pytest") || c.includes("test")) return "Running tests";
    if (c.includes("build")) return "Building project";
    // Process & system
    if (c.startsWith("kill ")) return "Stopping process";
    if (c.startsWith("lsof")) return "Checking ports";
    if (c.startsWith("ps ")) return "Checking processes";
    if (c.startsWith("curl") || c.startsWith("wget")) return "Fetching URL";
    if (c.startsWith("which") || c.startsWith("where")) return "Finding program";
    if (c.startsWith("echo")) return "Printing output";
    if (c.startsWith("cd ")) return "Changing directory";
    if (c.startsWith("pwd")) return "Checking current directory";
    // Ogu CLI
    if (c.includes("cli.mjs") || c.includes("ogu ")) {
      const parts = c.split(/\s+/);
      const cmdIdx = parts.findIndex(p => p.includes("cli.mjs"));
      const sub = cmdIdx >= 0 ? parts[cmdIdx + 1] : parts.find(p => !p.startsWith("-") && p !== "ogu" && p !== "node");
      if (sub) return `Running ogu ${sub}`;
      return "Running ogu command";
    }
    // Docker
    if (c.startsWith("docker")) return "Running Docker";
    // Python
    if (c.startsWith("python") || c.startsWith("pip")) return "Running Python";
    // Piped commands — describe first segment
    if (c.includes(" | ")) return describeBashCommand(c.split(" | ")[0]);
    // Chained commands — describe first segment
    if (c.includes(" && ")) return describeBashCommand(c.split(" && ")[0]);
    return "Running command";
  }

  function formatToolDisplay(name: string, input: any): string {
    if (!input) return name;
    if (name === "Write" && input.file_path) {
      const fname = input.file_path.split("/").pop() || input.file_path;
      return `Writing ${fname}`;
    }
    if (name === "Edit" && input.file_path) {
      const fname = input.file_path.split("/").pop() || input.file_path;
      return `Editing ${fname}`;
    }
    if (name === "Read" && input.file_path) {
      const fname = input.file_path.split("/").pop() || input.file_path;
      return `Reading ${fname}`;
    }
    if (name === "Bash" && input.command) return describeBashCommand(input.command);
    if (name === "Glob") return "Searching files";
    if (name === "Grep") return "Searching code";
    return name;
  }

  /* ── Main send handler ── */
  async function send() {
    const trimmed = input.trim();
    if (!trimmed) return;

    // If loading, silently abort current operation (no "Interrupted" message)
    if (active.loading) {
      abortRef.current?.abort();
      abortRef.current = null;
      setSessionLoading(active.id, false);
    }

    const quote = quotedText;
    setInput("");
    setImages([]);
    setQuotedText(null);
    // Reset textarea height after clearing input
    if (inputRef.current) {
      (inputRef.current as unknown as HTMLTextAreaElement).style.height = "auto";
    }

    const dir = detectDir(trimmed);
    lastPromptDirRef.current = dir;
    lastPromptLangRef.current = detectLang(trimmed);
    const imgNote = images.length > 0 ? ` [+${images.length} image${images.length > 1 ? "s" : ""}]` : "";
    appendLine(active.id, { id: uid(), type: "prompt", text: `> ${trimmed}${imgNote}`, dir, ts: Date.now() });

    // /ogu — pure client-side easter egg
    if (/^\/ogu$/i.test(trimmed)) {
      appendLine(active.id, { id: uid(), type: "ascii-art", text: oguAscii });
      return;
    }

    // Shell session — run as shell unless it's natural language
    if (active.type === "shell") {
      const isNaturalLanguage = RTL_REGEX.test(trimmed) || /^(hey|hi|hello|help|what|how|why|can you|please|tell me|build|create|make|explain|show)\b/i.test(trimmed);
      if (isNaturalLanguage) {
        await chatWithClaude(active.id, trimmed);
      } else {
        await runShell(active.id, trimmed);
      }
      return;
    }

    // Ogu session — parse command / shell / claude
    if (/^[!$]\s*/.test(trimmed)) {
      const cmd = trimmed.replace(/^[!$]\s*/, "");
      if (cmd) await runShell(active.id, cmd);
      return;
    }

    const result: ParseResult = parseChat(trimmed);
    if (result.type === "command") {
      const { command, args, description } = result.data;
      await runOguCommand(active.id, command, args, description);
      return;
    }

    // Detect URLs in user message — if message is ONLY URLs, show action buttons and stop.
    // If message has URLs + other text, send everything to Claude (URLs are context).
    const detectedUrls = extractUrls(trimmed);
    const textWithoutUrls = trimmed.replace(/https?:\/\/[^\s<>"{}|\\^`[\]]+/gi, "").trim();
    if (detectedUrls.length > 0 && textWithoutUrls.length === 0) {
      // Bare URL(s) — show scan buttons, don't send to Claude
      appendLine(active.id, { id: uid(), type: "url-action", text: "", urls: detectedUrls });
      return;
    }

    const messageWithContext = quote
      ? `[Referring to your previous message: "${quote}"]\n\n${trimmed}`
      : trimmed;

    await chatWithClaude(active.id, messageWithContext);
  }

  const colorMap: Record<Line["type"], string> = {
    prompt: "var(--accent)", reply: "var(--text)", output: "var(--text)",
    status: "var(--text-muted)", error: "var(--error)",
    tool: "var(--text-muted)", "tool-result": "var(--text-muted)",
    meta: "var(--text-muted)", choices: "var(--text)",
    phase: "var(--accent)", step: "var(--text-muted)",
    heading: "var(--text)", spacer: "transparent",
    involvement: "var(--accent)", diff: "var(--text-muted)", "ascii-art": "var(--text-muted)",
    "url-action": "var(--text-muted)",
  };

  const inputDir = detectDir(input);
  const promptChar = active.type === "shell" ? "$" : ">";

  return (
    <XStack flex={1} gap="$3">
      {/* ── Left: File tree ── */}
      <YStack width={260} borderRadius="$4" overflow="hidden"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <FileTreePanel />
      </YStack>

      {/* ── Center: Terminal ── */}
      <YStack flex={1} minWidth={400} borderRadius="$4" overflow="hidden"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>

        {/* Title bar */}
        <XStack height={36} alignItems="center" paddingHorizontal="$4" gap="$2"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
            backgroundColor: active.loading ? "var(--warning)" : active.claudeSessionId ? "var(--success)" : "var(--text-muted)",
            transition: "background-color 0.3s ease",
          }} title={active.loading ? "Working..." : active.claudeSessionId ? "Connected" : "No session"} />
          <Text fontSize="$1" fontFamily="$body" marginLeft="$1"
            style={{ color: "var(--text-muted)" }}>Ogu Studio</Text>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span
              onClick={(e) => { e.stopPropagation(); setModelMenuOpen((v) => !v); }}
              style={{
                cursor: "pointer", fontFamily: "var(--font)", fontSize: 11,
                color: "var(--accent)", padding: "2px 8px",
                borderRadius: 4, transition: "all 0.15s",
                border: "1px solid var(--border)",
                backgroundColor: modelMenuOpen ? "var(--accent-soft)" : "transparent",
                userSelect: "none",
              }}
              onMouseOver={(e) => { if (!modelMenuOpen) e.currentTarget.style.backgroundColor = "var(--accent-soft)"; }}
              onMouseOut={(e) => { if (!modelMenuOpen) e.currentTarget.style.backgroundColor = "transparent"; }}
            >{resolvedModel ? formatModelName(resolvedModel) : ({ sonnet: "Sonnet", opus: "Opus", haiku: "Haiku" }[currentModel] || currentModel)} ▾</span>
            {modelMenuOpen && (
              <div style={{
                position: "absolute", top: "100%", left: 0, marginTop: 4,
                backgroundColor: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 6, overflow: "hidden", zIndex: 100,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                minWidth: 130,
              }}>
                {[
                  { id: "sonnet", label: "Sonnet", desc: "Fast + smart" },
                  { id: "opus", label: "Opus", desc: "Most capable" },
                  { id: "haiku", label: "Haiku", desc: "Fastest" },
                ].map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (m.id !== currentModel) {
                        setCurrentModel(m.id);
                        setResolvedModel("");
                        appendLine(active.id, { id: uid(), type: "status", text: `  Switched to ${m.label}` });
                      }
                      setModelMenuOpen(false);
                    }}
                    style={{
                      padding: "8px 12px", cursor: "pointer",
                      fontFamily: "var(--font)", fontSize: 11,
                      color: currentModel === m.id ? "var(--accent)" : "var(--text)",
                      backgroundColor: currentModel === m.id ? "var(--accent-soft)" : "transparent",
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                      whiteSpace: "nowrap",
                    }}
                    onMouseOver={(e) => { if (currentModel !== m.id) e.currentTarget.style.backgroundColor = "var(--bg-input)"; }}
                    onMouseOut={(e) => { if (currentModel !== m.id) e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <span style={{ fontWeight: currentModel === m.id ? 600 : 400 }}>{m.label}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <span
            onClick={newChat}
            style={{
              cursor: "pointer", fontFamily: "var(--font)", fontSize: 11,
              color: "var(--text-muted)", padding: "2px 8px",
              borderRadius: 4, transition: "all 0.15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = "var(--error)"; e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)"; }}
            onMouseOut={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.backgroundColor = "transparent"; }}
            title="Clear conversation and start fresh"
          >New Chat</span>
        </XStack>

        {/* Main area: output + session sidebar */}
        <XStack flex={1}>
          {/* Output */}
          <ScrollView flex={1} ref={scrollRef} showsVerticalScrollIndicator={false}
            {...{
              onDragOver: (e: any) => { e.preventDefault(); setDragOver(true); },
              onDragLeave: () => setDragOver(false),
              onDrop: handleDrop,
              style: dragOver ? { outline: "2px dashed var(--accent)", outlineOffset: -4 } : undefined,
            } as any}
          >
            <YStack padding="$4" gap={0}>
              {(() => {
                // Pre-compute message groups: find the last reply-type line before each prompt/end
                const replyTypes = new Set(["reply", "phase", "step", "tool", "tool-result", "choices", "heading", "spacer", "url-action"]);
                const groupEndIndices = new Set<number>();
                for (let i = 0; i < active.lines.length; i++) {
                  if (active.lines[i].type === "prompt" && i > 0) {
                    // Find last reply-type line before this prompt
                    for (let j = i - 1; j >= 0; j--) {
                      if (replyTypes.has(active.lines[j].type)) { groupEndIndices.add(j); break; }
                    }
                  }
                }
                // Also mark the last reply-type line as group end
                for (let j = active.lines.length - 1; j >= 0; j--) {
                  if (replyTypes.has(active.lines[j].type)) { groupEndIndices.add(j); break; }
                }

                // Collect full message text for a group ending at index endIdx
                const getGroupText = (endIdx: number): string => {
                  const texts: string[] = [];
                  for (let j = endIdx; j >= 0; j--) {
                    const line = active.lines[j];
                    if (line.type === "prompt" || line.type === "meta" || line.type === "status" || line.type === "error") break;
                    if (line.type === "reply" || line.type === "phase" || line.type === "step") {
                      texts.unshift(line.text.replace(/^\s+/, ""));
                    }
                  }
                  return texts.join("\n");
                };

                // Compute direction per line based on message group context.
                // If ANY line in a reply group (between prompts) is RTL, ALL lines in that group are RTL.
                // Also inherits from the preceding prompt's direction.
                const lineDir: ("rtl" | "ltr")[] = new Array(active.lines.length).fill("ltr");
                let groupStart = 0;
                let promptDir: "rtl" | "ltr" = "ltr";

                const resolveGroup = (start: number, end: number) => {
                  let hasRtl = promptDir === "rtl";
                  for (let j = start; j <= end; j++) {
                    const line = active.lines[j];
                    if (line.type === "prompt") {
                      lineDir[j] = line.dir || detectDir(line.text);
                    } else if (replyTypes.has(line.type) && !hasRtl) {
                      if (line.dir === "rtl" || detectDir(line.text) === "rtl") hasRtl = true;
                    }
                  }
                  const dir = hasRtl ? "rtl" : "ltr";
                  for (let j = start; j <= end; j++) {
                    if (active.lines[j].type !== "prompt") lineDir[j] = dir;
                  }
                };

                for (let i = 0; i < active.lines.length; i++) {
                  const line = active.lines[i];
                  if (line.type === "prompt") {
                    if (i > groupStart) resolveGroup(groupStart, i - 1);
                    promptDir = line.dir || detectDir(line.text);
                    lineDir[i] = promptDir;
                    groupStart = i + 1;
                  }
                }
                if (groupStart < active.lines.length) {
                  resolveGroup(groupStart, active.lines.length - 1);
                }

                return active.lines.map((l, idx) => {
                const isGroupEnd = groupEndIndices.has(idx);
                const showSep = l.type === "prompt" && idx > 0;
                const showGapBeforeReply = idx > 0 && l.type === "reply" && active.lines[idx - 1].type === "prompt";
                const timeStr = l.ts ? new Date(l.ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "";
                // Detect transition from tool calls to message text — add visual gap
                const prevType = idx > 0 ? active.lines[idx - 1].type : null;
                const isToolBlock = l.type === "tool" || l.type === "tool-result" || l.type === "diff";
                const afterToolBlock = !isToolBlock && (prevType === "tool" || prevType === "tool-result");
                const newToolAction = l.type === "tool" && (prevType === "tool" || prevType === "tool-result" || prevType === "diff");
                const firstToolAfterReply = l.type === "tool" && prevType !== null && prevType !== "tool" && prevType !== "tool-result" && prevType !== "diff";
                const isInterrupted = l.type === "error" && l.text.includes("Interrupted");
                const isInlineBubble = l.type === "prompt" || isInterrupted;
                // Interrupted lines follow the last prompt's direction
                if (isInterrupted) {
                  for (let j = idx - 1; j >= 0; j--) {
                    if (active.lines[j].type === "prompt") { lineDir[idx] = lineDir[j]; break; }
                  }
                }
                return (
                  <div key={l.id} className="chat-line">
                    {showSep && (
                      <div style={{ height: 16 }} />
                    )}
                    {showGapBeforeReply && (
                      <div style={{ height: 10 }} />
                    )}
                    {firstToolAfterReply && (
                      <div style={{ height: 8 }} />
                    )}
                    {newToolAction && (
                      <div style={{ borderTop: "1px solid var(--border)", margin: "4px 8px", opacity: 0.3 }} />
                    )}
                    {l.type === "ascii-art" ? (
                      <div style={{ overflow: "auto", maxWidth: "100%", padding: "8px 0", display: "flex", justifyContent: lineDir[idx] === "rtl" ? "flex-end" : "flex-start" }}>
                        <AsciiArtBlock text={l.text} />
                      </div>
                    ) : l.type === "spacer" ? (
                      <div style={{ height: 10 }} />
                    ) : l.type === "heading" ? (
                      <div style={{
                        padding: "2px 10px", marginTop: 8, marginBottom: 2,
                        direction: lineDir[idx],
                        textAlign: lineDir[idx] === "rtl" ? "right" : "left",
                      }}>
                        <Text fontSize={14} fontWeight="700"
                          style={{
                            color: "var(--text)",
                            width: "100%",
                          }}>
                          {l.text}
                        </Text>
                      </div>
                    ) : l.type === "phase" ? (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", margin: "10px 0 6px",
                        borderRadius: 8,
                        background: "linear-gradient(135deg, var(--accent-soft) 0%, transparent 60%)",
                      }}>
                        <Text fontSize={14} fontFamily="$body" fontWeight="700"
                          style={{
                            color: "var(--accent)",
                            direction: lineDir[idx],
                            textAlign: lineDir[idx] === "rtl" ? "right" : "left",
                            letterSpacing: "0.02em",
                          }}>
                          {l.text}
                        </Text>
                      </div>
                    ) : l.type === "step" ? (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "4px 12px", margin: "2px 0",
                      }}>
                        <Text fontSize={12} fontFamily="$body" fontWeight="600"
                          style={{
                            color: "var(--text-muted)",
                            direction: lineDir[idx],
                            textAlign: lineDir[idx] === "rtl" ? "right" : "left",
                          }}>
                          {l.text}
                        </Text>
                      </div>
                    ) : l.type === "involvement" && l.involvementLevels ? (() => {
                      const levels = l.involvementLevels;
                      const currentIdx = sliderValues[l.id] ?? 0;
                      const touched = sliderValues[l.id] !== undefined;
                      const committed = sliderValues[`${l.id}:done`] !== undefined;

                      const sendInvolvement = async (i: number) => {
                        const chosen = levels[i];
                        setSliderValues((prev) => ({ ...prev, [`${l.id}:done`]: 1 }));
                        // Persist involvement level to server — MUST complete before chatWithClaude
                        // otherwise server sees no involvement and sends needs_involvement again
                        try {
                          await fetch("/api/state/involvement", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ level: chosen.value }),
                          });
                        } catch { /* best-effort */ }
                        const dir = detectDir(chosen.label);
                        appendLine(active.id, { id: uid(), type: "prompt", text: `> ${chosen.label}`, dir, ts: Date.now() });
                        if (pendingMessage) {
                          const combined = `[Involvement level: ${chosen.value}]\n\n${pendingMessage}`;
                          setPendingMessage(null);
                          chatWithClaude(active.id, combined);
                        } else {
                          chatWithClaude(active.id, `[Involvement level: ${chosen.value}]`);
                        }
                      };

                      if (committed) return null;
                      const sliderDir = detectDir(levels[0]?.label || "") === "rtl" ? "rtl" : lineDir[idx];
                      // For RTL, reverse the visual order so "autopilot" is on the right
                      const visualLevels = sliderDir === "rtl" ? [...levels].reverse() : levels;
                      const visualIdx = sliderDir === "rtl" ? (levels.length - 1 - currentIdx) : currentIdx;

                      // Always show active level (default = first)
                      const activeLevel = levels[currentIdx];
                      return (
                        <div style={{
                          marginBottom: 12, direction: sliderDir, width: "80%",
                          marginLeft: sliderDir === "rtl" ? "auto" : undefined,
                          marginRight: sliderDir === "rtl" ? undefined : undefined,
                        }}>
                        {/* Slider card — dots on labels, no track line */}
                        <div style={{
                          border: "1px solid var(--border)", borderRadius: 8,
                          padding: "14px 20px 10px",
                          backgroundColor: "var(--bg-card)",
                        }}>
                          {/* Custom dot track — dots centered under each label */}
                          <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
                            {/* Connecting line behind dots */}
                            <div style={{
                              position: "absolute", top: 4, left: "12%", right: "12%", height: 2,
                              backgroundColor: "var(--border)", borderRadius: 1, zIndex: 0,
                            }} />
                            {visualLevels.map((lvl, i) => {
                              const isActive = i === visualIdx;
                              const realIdx = sliderDir === "rtl" ? (levels.length - 1 - i) : i;
                              return (
                                <div key={i}
                                  onClick={() => setSliderValues((prev) => ({ ...prev, [l.id]: realIdx }))}
                                  style={{
                                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                                    cursor: "pointer", zIndex: 1,
                                  }}
                                >
                                  {/* Dot */}
                                  <div style={{
                                    width: isActive ? 12 : 8, height: isActive ? 12 : 8,
                                    borderRadius: "50%",
                                    backgroundColor: isActive ? "var(--accent)" : "var(--text-muted)",
                                    border: isActive ? "2px solid var(--text)" : "none",
                                    transition: "all 0.15s",
                                    boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
                                  }} />
                                  {/* Label */}
                                  <div style={{
                                    fontFamily: "var(--font)", fontSize: 11, fontWeight: 600,
                                    color: isActive ? "var(--accent)" : "var(--text)",
                                    opacity: isActive ? 1 : 0.4,
                                    marginTop: 8, textAlign: "center",
                                    transition: "all 0.15s",
                                  }}>
                                    {lvl.label.replace("\n", " ")}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* Description + confirm button — outside card, space-between */}
                        <div style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          marginTop: 8, gap: 12, minHeight: 28,
                        }}>
                          <div style={{
                            fontFamily: "var(--font)", fontSize: 12, color: "var(--text-muted)",
                            lineHeight: 1.4, flex: 1,
                            textAlign: sliderDir === "rtl" ? "right" : "left",
                          }}>
                            {activeLevel.description}
                          </div>
                          <button
                            onClick={() => sendInvolvement(currentIdx)}
                            style={{
                              fontFamily: "var(--font)", fontSize: 12, fontWeight: 600,
                              padding: "7px 22px",
                              backgroundColor: "var(--accent)",
                              color: "var(--bg)",
                              border: "none", borderRadius: 6,
                              cursor: "pointer",
                              transition: "opacity 0.15s",
                              whiteSpace: "nowrap", flexShrink: 0,
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.opacity = "0.85"; }}
                            onMouseOut={(e) => { e.currentTarget.style.opacity = "1"; }}
                          >{activeLevel.label.replace("\n", " ")}</button>
                        </div>
                        </div>
                      );
                    })() : l.type === "choices" && l.choices ? (() => {
                      const choicesDir = lineDir[idx];
                      const choicesSent = selectedChoices[`${l.id}:sent`];
                      const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
                      // Single click sends immediately
                      const sendChoice = (ci: number) => {
                        if (choicesSent) return;
                        const label = (l.choices![ci] || "").replace(/^\d+\.\s+/, "").replace(/^[•·-]\s*/, "").replace(/\*\*/g, "").trim();
                        setSelectedChoices((prev) => ({ ...prev, [`${l.id}:sent`]: new Set([ci]) }));
                        const dir = detectDir(label);
                        appendLine(active.id, { id: uid(), type: "prompt", text: `> ${label}`, dir, ts: Date.now() });
                        chatWithClaude(active.id, label);
                      };
                      // Find the question text before these choices (for "Other..." quoting)
                      const findQuestion = (): string => {
                        for (let j = idx - 1; j >= 0; j--) {
                          const prev = active.lines[j];
                          if (prev.type === "prompt") break;
                          if (prev.type === "reply" && prev.text.trim().endsWith("?")) {
                            return prev.text.trim();
                          }
                        }
                        return "";
                      };
                      // Extract letter prefix: English (A, B, C, D) or Hebrew (א, ב, ג, ד)
                      const HEB_LETTERS: Record<string, string> = { "א": "א", "ב": "ב", "ג": "ג", "ד": "ד", "ה": "ה", "ו": "ו", "ז": "ז", "ח": "ח" };
                      const parseChoice = (raw: string) => {
                        const clean = raw.replace(/^\d+\.\s+/, "").replace(/^[•·-]\s*/, "").replace(/\*\*/g, "").replace(/\?$/, "").trim();
                        // English: "A — ...", "B - ..."
                        const enMatch = clean.match(/^([A-Z])\s*[.—–\-:]\s*(.+)$/i);
                        if (enMatch) return { letter: enMatch[1].toUpperCase(), text: enMatch[2].trim() };
                        // Hebrew: "א. ...", "ב — ..."
                        const heMatch = clean.match(/^([א-ח])\s*[.—–\-:]\s*(.+)$/);
                        if (heMatch) return { letter: HEB_LETTERS[heMatch[1]] || heMatch[1], text: heMatch[2].trim() };
                        return { letter: null, text: clean };
                      };
                      return (
                        <div style={{ padding: "8px 0", direction: choicesDir, marginLeft: choicesDir === "rtl" ? "auto" : undefined }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {l.choices.map((choice, ci) => {
                              const parsed = parseChoice(choice);
                              const letter = parsed.letter || LETTERS[ci] || String(ci + 1);
                              const wasSent = choicesSent?.has(ci);
                              const isDisabled = !!choicesSent && !wasSent;
                              return (
                                <button
                                  key={ci}
                                  onClick={() => sendChoice(ci)}
                                  disabled={!!choicesSent}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 10,
                                    padding: "10px 14px",
                                    fontFamily: "var(--font)", fontSize: 13,
                                    backgroundColor: wasSent ? "var(--accent-soft)" : "var(--bg-input)",
                                    color: wasSent ? "var(--accent)" : isDisabled ? "var(--text-muted)" : "var(--text)",
                                    border: `1.5px solid ${wasSent ? "var(--accent)" : "var(--border)"}`,
                                    borderRadius: 8,
                                    cursor: choicesSent ? "default" : "pointer",
                                    transition: "all 0.15s",
                                    textAlign: "start",
                                    direction: detectDir(parsed.text),
                                    opacity: isDisabled ? 0.4 : 1,
                                  }}
                                  onMouseOver={(e) => { if (!choicesSent) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.backgroundColor = "var(--accent-soft)"; } }}
                                  onMouseOut={(e) => { if (!choicesSent) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.backgroundColor = "var(--bg-input)"; } }}
                                >
                                  <span style={{
                                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                                    width: 26, height: 26, minWidth: 26,
                                    borderRadius: "50%",
                                    backgroundColor: wasSent ? "var(--accent)" : "transparent",
                                    border: `2px solid ${wasSent ? "var(--accent)" : "var(--text-muted)"}`,
                                    color: wasSent ? "var(--bg)" : "var(--text-muted)",
                                    fontSize: 11, fontWeight: 700,
                                    transition: "all 0.15s",
                                  }}>{letter}</span>
                                  <span style={{ flex: 1, lineHeight: 1.4 }}>{parsed.text}</span>
                                </button>
                              );
                            })}
                            {!choicesSent && (
                            <button
                              onClick={() => {
                                const q = findQuestion();
                                if (q) quoteText(q);
                                setTimeout(() => inputRef.current?.focus(), 30);
                              }}
                              style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "10px 14px",
                                fontFamily: "var(--font)", fontSize: 13,
                                backgroundColor: "transparent",
                                color: "var(--text-muted)",
                                border: "1.5px dashed var(--border)",
                                borderRadius: 8,
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                              onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                            >
                              <span style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                width: 26, height: 26, minWidth: 26,
                                borderRadius: "50%",
                                border: "2px dashed var(--text-muted)",
                                fontSize: 11, fontWeight: 700,
                                color: "var(--text-muted)",
                              }}>?</span>
                              <span>Other...</span>
                            </button>
                            )}
                          </div>
                        </div>
                      );
                    })() : l.type === "url-action" && l.urls ? (
                      <div style={{ display: "flex", gap: 6, padding: "6px 10px", flexWrap: "wrap" }}>
                        {l.urls.map((url, i) => {
                          let domain: string;
                          try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { domain = url; }
                          return (
                            <button
                              key={i}
                              onClick={async () => {
                                appendLine(active.id, { id: uid(), type: "status", text: `  Scanning ${domain}...` });
                                try {
                                  await fetch("/api/brand/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
                                } catch (err: any) {
                                  appendLine(active.id, { id: uid(), type: "error", text: `  Scan failed: ${err.message}` });
                                }
                              }}
                              style={{
                                fontFamily: "var(--font)", fontSize: 11, fontWeight: 500,
                                background: "var(--bg-input)", border: "1px solid var(--border)",
                                borderRadius: 6, padding: "5px 12px",
                                color: "var(--accent)", cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.backgroundColor = "var(--accent-soft)"; }}
                              onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.backgroundColor = "var(--bg-input)"; }}
                            >Scan brand: {domain}</button>
                          );
                        })}
                        {l.urls.length >= 2 && (
                          <button
                            onClick={async () => {
                              appendLine(active.id, { id: uid(), type: "status", text: `  Compositing ${l.urls!.length} references...` });
                              try {
                                await fetch("/api/brand/reference/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls: l.urls }) });
                              } catch (err: any) {
                                appendLine(active.id, { id: uid(), type: "error", text: `  Reference failed: ${err.message}` });
                              }
                            }}
                            style={{
                              fontFamily: "var(--font)", fontSize: 11, fontWeight: 500,
                              background: "var(--bg-input)", border: "1px solid var(--accent)",
                              borderRadius: 6, padding: "5px 12px",
                              color: "var(--accent)", cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "var(--accent-soft)"; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-input)"; }}
                          >Composite reference ({l.urls.length} sites)</button>
                        )}
                      </div>
                    ) : l.type === "diff" ? (
                    <div style={{
                      padding: "0 2px", margin: "0 -2px",
                      fontFamily: "var(--font)", fontSize: 11,
                      whiteSpace: "pre-wrap",
                      color: l.diffType === "add" ? "#4ade80" : l.diffType === "remove" ? "var(--error)" : "var(--text-muted)",
                      opacity: l.diffType === "summary" ? 0.7 : 0.8,
                      fontWeight: 300,
                    }}>
                      {l.diffType === "remove" && <span style={{ color: "var(--error)", fontWeight: 500 }}>- </span>}
                      {l.diffType === "add" && <span style={{ color: "#4ade80", fontWeight: 500 }}>+ </span>}
                      {l.text}
                    </div>
                    ) : (
                    <div style={isInlineBubble ? {
                      textAlign: lineDir[idx] === "rtl" ? "right" : "left",
                      margin: "4px -6px",
                      marginTop: afterToolBlock ? 10 : undefined,
                    } : undefined}>
                    <div style={{
                      display: isInlineBubble ? "inline-flex" : "flex",
                      alignItems: "flex-start",
                      position: "relative",
                      borderRadius: 6,
                      padding: l.type === "prompt" ? "6px 10px" : isInterrupted ? "4px 10px" : l.type === "reply" ? "2px 10px" : "0 2px",
                      margin: isInlineBubble ? undefined : "0 -2px",
                      marginTop: isInlineBubble ? undefined : (afterToolBlock ? 10 : undefined),
                      backgroundColor: l.type === "prompt" ? "rgba(255,255,255,0.03)" : isInterrupted ? "rgba(239,68,68,0.1)" : undefined,
                    }}
                    >
                      <Text fontSize={13} lineHeight={19}
                        style={{
                          flex: 1,
                          color: l.type === "meta" ? "var(--text-muted)" : colorMap[l.type],
                          direction: lineDir[idx],
                          textAlign: lineDir[idx] === "rtl" ? "right" : "left",
                          fontWeight: isToolBlock ? "300" : undefined,
                          fontSize: l.type === "meta" ? 11 : (isToolBlock ? 11 : undefined),
                          opacity: l.type === "meta" ? 0.7 : undefined,
                          userSelect: "text",
                        }} whiteSpace="pre-wrap">
                        {l.text}
                      </Text>
                      {(l.type === "prompt" || l.type === "meta") && timeStr && (
                        <span style={{
                          flexShrink: 0, fontFamily: "var(--font)", fontSize: 10,
                          color: "var(--text-muted)", opacity: 0.5,
                          lineHeight: "22px", paddingLeft: 8,
                        }}>{timeStr}</span>
                      )}
                    </div>
                    </div>
                    )}
                    {isGroupEnd && l.type !== "choices" && l.type !== "involvement" && getGroupText(idx).trim() !== "" && (
                      <div style={{ display: "flex", justifyContent: "flex-end", padding: "2px 2px 4px" }}>
                        <span
                          className="quote-btn"
                          onClick={(e) => { e.stopPropagation(); quoteText(getGroupText(idx)); }}
                          style={{
                            cursor: "pointer",
                            fontSize: 11,
                            fontFamily: "var(--font)",
                            padding: "2px 8px",
                            borderRadius: 4,
                            color: "var(--text-muted)",
                            opacity: 0,
                            transition: "opacity 0.15s",
                          }}
                          title="Quote message"
                        ><Icon d={icons.quote} size={11} /> Quote</span>
                      </div>
                    )}
                  </div>
                );
              });
              })()}
              {active.loading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0 4px 4px" }}>
                  <span className="thinking-pulse" style={{ display: "inline-flex", alignItems: "center" }}>
                    <Icon d={icons.logo} size={14} stroke="var(--accent)" />
                  </span>
                  <span className="thinking-shimmer" style={{
                    fontFamily: "var(--font)", fontSize: 13, fontWeight: 600,
                    letterSpacing: "0.5px",
                  }}>
                    {thinkingVerb}
                  </span>
                  <span className="thinking-dots" style={{ fontFamily: "var(--font)", fontSize: 13, fontWeight: 600 }}>
                    <span style={{ color: "var(--accent)" }}>.</span>
                    <span style={{ color: "var(--accent)" }}>.</span>
                    <span style={{ color: "var(--accent)" }}>.</span>
                  </span>
                </div>
              )}
            </YStack>
          </ScrollView>

          {/* Session sidebar */}
          <div style={{
            width: sidebarExpanded ? 200 : 120, borderLeft: "1px solid var(--border)",
            display: "flex", flexDirection: "column",
            flexShrink: 0, transition: "width 0.15s ease",
          }}>
            {/* Header */}
            <div style={{
              padding: "6px 10px",
              borderBottom: "1px solid var(--border)",
              fontFamily: "var(--font)", fontSize: 12,
              color: "var(--text-muted)", userSelect: "none",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span
                onClick={() => setSidebarExpanded((v) => !v)}
                style={{ fontSize: 10, cursor: "pointer" }}
                onMouseOver={(e) => (e.currentTarget.style.color = "var(--text)")}
                onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                title={sidebarExpanded ? "Collapse" : "Expand"}
              >{sidebarExpanded ? <Icon d={icons.chevronLeft} size={10} /> : <Icon d={icons.chevronRight} size={10} />} SESSIONS</span>
              <span
                onClick={addShell}
                style={{ fontSize: 16, cursor: "pointer" }}
                onMouseOver={(e) => (e.currentTarget.style.color = "var(--text)")}
                onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                title="Add shell"
              >+</span>
            </div>

            {/* Session list */}
            <div style={{ flex: 1, overflow: "auto" }}>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setActiveId(s.id)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "5px 10px", cursor: "pointer",
                    fontFamily: "var(--font)", fontSize: 11,
                    color: s.id === activeId ? "var(--text)" : "var(--text-muted)",
                    backgroundColor: s.id === activeId ? "var(--bg-card-hover)" : "transparent",
                    userSelect: "none",
                  }}
                  onMouseOver={(e) => { if (s.id !== activeId) e.currentTarget.style.backgroundColor = "var(--bg-input)"; }}
                  onMouseOut={(e) => { if (s.id !== activeId) e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, overflow: "hidden" }}>
                    <span style={{ flexShrink: 0, display: "inline-flex" }}>{s.type === "ogu" ? <Icon d={icons.logo} size={10} stroke="var(--accent)" /> : <Icon d={icons.terminal} size={10} />}</span>
                    {renamingId === s.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                        onBlur={commitRename}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: "100%", background: "var(--bg-input)", border: "1px solid var(--border)",
                          borderRadius: 3, outline: "none", color: "var(--text)",
                          fontFamily: "var(--font)", fontSize: 11, padding: "1px 4px",
                        }}
                      />
                    ) : (
                      <span
                        onDoubleClick={(e) => { e.stopPropagation(); startRename(s.id); }}
                        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >{s.label}</span>
                    )}
                  </span>
                  {renamingId !== s.id && (
                    <span
                      onClick={(e) => { e.stopPropagation(); closeSession(s.id); }}
                      style={{ fontSize: 10, padding: "0 2px", color: "var(--text-muted)", flexShrink: 0 }}
                      onMouseOver={(e) => (e.currentTarget.style.color = "var(--error)")}
                      onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    ><Icon d={icons.trash} size={10} /></span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </XStack>

        {/* Image previews */}
        {images.length > 0 && (
          <div style={{
            display: "flex", gap: 8, padding: "8px 16px 0",
            borderTop: "1px solid var(--border)", flexWrap: "wrap",
          }}>
            {images.map((img, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={img.base64} alt={img.name} style={{
                  width: 48, height: 48, objectFit: "cover",
                  borderRadius: 6, border: "1px solid var(--border)",
                }} />
                <span
                  onClick={() => removeImage(i)}
                  style={{
                    position: "absolute", top: -4, right: -4,
                    width: 16, height: 16, borderRadius: "50%",
                    backgroundColor: "var(--error)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, cursor: "pointer", lineHeight: 1,
                  }}
                ><Icon d={icons.x} size={10} /></span>
              </div>
            ))}
          </div>
        )}

        {/* Quoted reference */}
        {quotedText && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 16px 0",
            borderTop: "1px solid var(--border)",
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px",
              borderRadius: 4,
              backgroundColor: "var(--accent-soft)",
              maxWidth: "80%",
            }}>
              <span style={{
                fontFamily: "var(--font)", fontSize: 11,
                color: "var(--text-muted)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                direction: detectDir(quotedText),
              }}>
                {quotedText.length > 80 ? quotedText.slice(0, 80) + "..." : quotedText}
              </span>
              <span
                onClick={() => setQuotedText(null)}
                style={{
                  cursor: "pointer", flexShrink: 0, display: "inline-flex",
                  color: "var(--text-muted)", padding: 2, borderRadius: 3,
                }}
                onMouseOver={(e) => { e.currentTarget.style.color = "var(--error)"; }}
                onMouseOut={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
              ><Icon d={icons.x} size={10} /></span>
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 8,
          padding: "12px 16px",
          borderTop: (images.length > 0 || quotedText) ? "none" : "1px solid var(--border)",
        }}>
          <span style={{
            color: "var(--accent)", fontFamily: "var(--font)",
            fontSize: 14, fontWeight: 600, lineHeight: "21px",
          }}>{promptChar}</span>
          <textarea
            ref={inputRef as any}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); setHistoryIdx(-1); savedInputRef.current = ""; }
              if (e.key === "Escape" && active.loading) stopCurrent();
              if (e.key === "ArrowUp" && !e.shiftKey) {
                const prompts = active.lines.filter((l) => l.type === "prompt").map((l) => l.text.replace(/^>\s*/, "").replace(/\s*\[\+\d+ images?\]$/, ""));
                if (prompts.length === 0) return;
                e.preventDefault();
                const newIdx = historyIdx < 0 ? prompts.length - 1 : Math.max(0, historyIdx - 1);
                if (historyIdx < 0) savedInputRef.current = input;
                setHistoryIdx(newIdx);
                setInput(prompts[newIdx]);
              }
              if (e.key === "ArrowDown" && !e.shiftKey && historyIdx >= 0) {
                const prompts = active.lines.filter((l) => l.type === "prompt").map((l) => l.text.replace(/^>\s*/, "").replace(/\s*\[\+\d+ images?\]$/, ""));
                e.preventDefault();
                if (historyIdx >= prompts.length - 1) {
                  setHistoryIdx(-1);
                  setInput(savedInputRef.current);
                } else {
                  setHistoryIdx(historyIdx + 1);
                  setInput(prompts[historyIdx + 1]);
                }
              }
            }}
            rows={1}
            placeholder={active.loading
              ? "Press Esc to stop, or type to interrupt..."
              : active.type === "ogu" ? "Type a command or chat..." : "Run a shell command..."}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "var(--text)", fontFamily: "var(--font)", fontSize: 14,
              direction: inputDir, textAlign: inputDir === "rtl" ? "right" : "left",
              resize: "none", lineHeight: "21px", overflow: "hidden",
            }}
          />
          {/* Upload image button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <span
            onClick={() => !uploading && fileInputRef.current?.click()}
            style={{
              cursor: uploading ? "wait" : "pointer", fontFamily: "var(--font)", fontSize: 16,
              color: uploading ? "var(--accent)" : "var(--text-muted)", lineHeight: "21px",
              padding: "0 2px", flexShrink: 0,
              opacity: uploading ? 0.6 : 1,
            }}
            onMouseOver={(e) => { if (!uploading) e.currentTarget.style.color = "var(--accent)"; }}
            onMouseOut={(e) => { if (!uploading) e.currentTarget.style.color = "var(--text-muted)"; }}
            title={uploading ? "Uploading..." : "Attach image"}
          >{uploading ? <Icon d={icons.loader} size={14} /> : <Icon d={icons.paperclip} size={14} />}</span>
        </div>
      </YStack>
    </XStack>
  );
}
