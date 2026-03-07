import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "@/store";
import { api } from "@/lib/api";
import { Icon, icons } from "@/lib/icons";
import { IconBtn } from "@/components/shared/IconBtn";
import {
  ARCHETYPES,
  getArchetypeById,
  type Archetype,
  type ArchetypeStep,
  type WizardMode,
} from "@/data/archetypes";

// ── Types ──

interface ClassifyResult {
  archetypes: Array<{ id: string; title: string; confidence: number; description: string }>;
  suggested_mode: string | null;
  disambiguation: { question: string; options: string[] } | null;
  detail_level: string;
}

interface PersonalizedQuestion {
  id: string;
  type: "select" | "multiselect" | "short_text";
  prompt: string;
  options?: string[];
  default?: string | null;
  required: boolean;
  skipped?: boolean;
}

type Stage = "input" | "classifying" | "classify" | "disambiguate" | "clarify" | "steps" | "launching";

type LaunchPhase = "brief" | "cto" | "ready" | "error";

// ── Helpers ──

const PLACEHOLDERS: Record<WizardMode, string> = {
  website: "Describe the website you want to build in 2-5 sentences...",
  application: "Describe the app you want to build in 2-5 sentences...",
  venture: "Describe your startup or venture idea in 2-5 sentences...",
};

const MODE_NOUNS: Record<WizardMode, string> = {
  website: "Websites",
  application: "Apps",
  venture: "Startups",
};

const ADJECTIVES: Record<WizardMode, string[]> = {
  website:     ["Stunning", "Gorgeous", "Polished"],
  application: ["Powerful", "Seamless", "Flawless"],
  venture:     ["Fearless", "Superior", "Inspired"],
};


export function RotatingWord({ words, interval = 3000 }: { words: string[]; interval?: number }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"visible" | "flipOut" | "flipIn">("visible");
  const [displayWord, setDisplayWord] = useState(words[0]);
  const localTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fixedWidth, setFixedWidth] = useState(0);
  const staggerMs = 28;

  // Measure widest word once
  useEffect(() => {
    if (!measureRef.current) return;
    let max = 0;
    for (let i = 0; i < measureRef.current.children.length; i++) {
      max = Math.max(max, (measureRef.current.children[i] as HTMLElement).offsetWidth);
    }
    setFixedWidth(max);
  }, [words]);

  useEffect(() => {
    const cycle = () => {
      setPhase("flipOut");
      const outDur = displayWord.length * staggerMs + 420;

      const t1 = setTimeout(() => {
        const next = (index + 1) % words.length;
        setIndex(next);
        setDisplayWord(words[next]);
        setPhase("flipIn");
      }, outDur);

      const nextWord = words[(index + 1) % words.length];
      const inDur = nextWord.length * staggerMs + 460;
      const t2 = setTimeout(() => {
        setPhase("visible");
      }, outDur + inDur);

      localTimers.current = [t1, t2];
    };

    const mainTimer = setTimeout(cycle, interval);
    return () => {
      clearTimeout(mainTimer);
      localTimers.current.forEach(clearTimeout);
    };
  }, [index, displayWord, interval, words]);

  const chars = displayWord.split("");

  const letterStyle = (i: number): React.CSSProperties => ({
    display: "inline-block",
    transformStyle: "preserve-3d",
    backfaceVisibility: "hidden",
    animation: phase === "flipOut"
      ? `letter-flip-out 0.4s ease ${i * staggerMs}ms both`
      : phase === "flipIn"
        ? `letter-flip-in 0.45s ease ${i * staggerMs}ms both`
        : "none",
  });

  return (
    <>
      <span
        ref={measureRef}
        aria-hidden
        style={{ position: "absolute", visibility: "hidden", whiteSpace: "nowrap", font: "inherit", letterSpacing: "inherit" }}
      >
        {words.map((w) => <span key={w} style={{ display: "inline-block" }}>{w}</span>)}
      </span>
      <span style={{
        display: "inline-block",
        textAlign: "center",
        width: fixedWidth || undefined,
        whiteSpace: "nowrap",
        perspective: 5000,
        transformStyle: "preserve-3d",
      }}>
        {chars.map((c, i) => (
          <span key={`${index}-${i}`} style={letterStyle(i)}>
            {c}
          </span>
        ))}
      </span>
    </>
  );
}

// ── Brief Card — code-viewer style ──

interface BriefData { overview: string; audience: string[]; features: string[]; goal: string }

function BriefCard({ brief }: { brief: BriefData }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = [
      `Overview: ${brief.overview}`,
      `Audience: ${brief.audience.join(", ")}`,
      `Features: ${brief.features.join(", ")}`,
      `Goal: ${brief.goal}`,
    ].join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const K = ({ children }: { children: React.ReactNode }) => (
    <span style={{ color: "rgba(255,255,255,0.55)" }}>{children}</span>
  );
  const S = ({ children }: { children: React.ReactNode }) => (
    <span style={{ color: "#63f19d" }}>{children}</span>
  );
  const P = ({ children }: { children: React.ReactNode }) => (
    <span style={{ color: "rgba(255,255,255,0.35)" }}>{children}</span>
  );

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <button
          onClick={handleCopy}
          style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: copied ? "var(--color-accent)" : "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: 5, transition: "color 0.2s" }}
        >
          {copied ? (
            <Icon d={icons.check} size={13} stroke="var(--color-accent)" />
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono, monospace)" }}>{copied ? "Copied" : "Copy"}</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono, monospace)" }}>BRIEF</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
      </div>
      {/* Content */}
      <div style={{ padding: "14px 16px", fontFamily: "var(--font-mono, 'SF Mono', Menlo, monospace)", fontSize: 12, lineHeight: 1.7, overflowY: "auto", maxHeight: 280 }}>
        <P>{"{"}</P>
        <div style={{ paddingLeft: 16 }}>
          {/* overview */}
          <div><K>"overview"</K><P>: </P><S>"{brief.overview}"</S><P>,</P></div>
          {/* audience */}
          <div style={{ marginTop: 6 }}><K>"audience"</K><P>: [</P></div>
          {brief.audience.map((a, i) => (
            <div key={i} style={{ paddingLeft: 16 }}>
              <S>"{a}"</S><P>{i < brief.audience.length - 1 ? "," : ""}</P>
            </div>
          ))}
          <div><P>],</P></div>
          {/* features */}
          <div style={{ marginTop: 6 }}><K>"features"</K><P>: [</P></div>
          {brief.features.map((f, i) => (
            <div key={i} style={{ paddingLeft: 16 }}>
              <S>"{f}"</S><P>{i < brief.features.length - 1 ? "," : ""}</P>
            </div>
          ))}
          <div><P>],</P></div>
          {/* goal */}
          <div style={{ marginTop: 6 }}><K>"goal"</K><P>: </P><S>"{brief.goal}"</S></div>
        </div>
        <P>{"}"}</P>
      </div>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: value >= 0.5 ? "var(--color-accent)" : "var(--color-text-muted)",
          }}
        />
      </div>
      <span className="text-xs text-text-muted w-8 text-right">{pct}%</span>
    </div>
  );
}

function StepIndicator({ steps, currentIndex }: { steps: ArchetypeStep[]; currentIndex: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all"
            style={i <= currentIndex ? {
              background: "linear-gradient(0deg, rgba(99,241,157,0) 0%, rgba(99,241,157,0.08) 2.45%, rgba(99,241,157,0) 126.14%)",
              border: "1px solid rgba(99,241,157,0.35)",
              color: "rgba(255,255,255,0.95)",
              boxShadow: "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 16px rgba(99,241,157,0.1)",
            } : {
              background: "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 2.45%, rgba(255,255,255,0) 126.14%)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.65)",
              boxShadow: "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset",
            }}
          >
            {i < currentIndex ? "\u2713" : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className="w-6 h-px" style={{ backgroundColor: i < currentIndex ? "var(--color-accent)" : "var(--color-border)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──

export function ArchetypeWizard({ mode: initialMode, onBack }: { mode: WizardMode; onBack: () => void }) {
  const setRoute = useStore((s) => s.setRoute);
  const setPendingChatMessage = useStore((s) => s.setPendingChatMessage);
  const setOsBooted = useStore((s) => s.setOsBooted);
  const setActiveProjectSlug = useStore((s) => s.setActiveProjectSlug);
  const setCurrentStage = useStore((s) => s.setCurrentStage);

  const [activeMode, setActiveMode] = useState<WizardMode>(initialMode);
  const [stage, setStage] = useState<Stage>("input");
  const [description, setDescription] = useState("");
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [selectedArchetype, setSelectedArchetype] = useState<Archetype | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [personalizedQuestions, setPersonalizedQuestions] = useState<Map<string, PersonalizedQuestion[]>>(new Map());
  const [clarifyQuestions, setClarifyQuestions] = useState<PersonalizedQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loadingPersonalize, setLoadingPersonalize] = useState(false);
  const [loadingClarify, setLoadingClarify] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [expandedBrief, setExpandedBrief] = useState<BriefData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllArchetypes, setShowAllArchetypes] = useState(false);
  const [launchPhase, setLaunchPhase] = useState<LaunchPhase>("brief");
  const [launchSlug, setLaunchSlug] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }, [description]);

  // ── Expand prompt ──

  const handleExpand = useCallback(async () => {
    if (!description.trim() || expanding) return;
    setExpanding(true);
    setExpandedBrief(null);
    try {
      const result = await api.expandPrompt(description.trim(), activeMode);
      setDescription(result.expanded);
      if (result.brief) setExpandedBrief(result.brief);
    } catch (err: any) {
      setError(err.message || "Expansion failed");
    }
    setExpanding(false);
  }, [description, activeMode, expanding]);

  // ── Stage 1: Classify ──

  const handleClassify = useCallback(async (desc?: string) => {
    const text = (desc || description).trim();
    if (!text) return;
    setStage("classifying");
    setError(null);

    try {
      const result = await api.classifyArchetype(activeMode, text);

      // Auto-switch mode if the LLM detected a mismatch
      if (result.suggested_mode && result.suggested_mode !== activeMode) {
        setActiveMode(result.suggested_mode as WizardMode);
      }

      setClassifyResult(result);

      const topConfidence = result.archetypes[0]?.confidence || 0;
      if (topConfidence < 0.45 && result.disambiguation) {
        setStage("disambiguate");
      } else {
        setStage("classify");
      }
    } catch (err: any) {
      setError(err.message || "Classification failed");
      setStage("input");
    }
  }, [description, activeMode]);

  // ── Stage 2b: Disambiguate → re-classify ──

  const handleDisambiguate = useCallback(async (choice: string) => {
    const enriched = `${description.trim()}\nPreference: ${choice}`;
    setDescription(enriched);
    await handleClassify(enriched);
  }, [description, handleClassify]);

  // ── Stage 3: personalizeStep (declared first — used by handleSelectArchetype) ──

  const personalizeStep = useCallback(async (archetype: Archetype, step: ArchetypeStep, currentAnswers: Record<string, any>) => {
    setLoadingPersonalize(true);
    try {
      const result = await api.personalizeStep({
        archetypeId: archetype.id,
        stepId: step.id,
        step: { title: step.title, questions: step.questions },
        userDescription: description,
        previousAnswers: currentAnswers,
        detailLevel: classifyResult?.detail_level,
      });
      const CATCHALL = /^(mix of|all of the above|combination|multiple|various|hybrid)/i;
      const visible = result.questions
        .filter((q: any) => !q.skipped)
        .map((q: any) => q.options ? { ...q, options: q.options.filter((o: string) => !CATCHALL.test(o.trim())) } : q);
      setPersonalizedQuestions((prev) => {
        const next = new Map(prev);
        next.set(step.id, visible);
        return next;
      });

      // Auto-apply defaults (including skipped questions' inferred values)
      const defaults: Record<string, any> = {};
      for (const q of result.questions) {
        if (q.default && !currentAnswers[q.id]) {
          defaults[q.id] = q.default;
        }
      }
      if (Object.keys(defaults).length > 0) {
        setAnswers((prev) => ({ ...prev, ...defaults }));
      }
    } catch {
      // Use original questions as fallback
      setPersonalizedQuestions((prev) => {
        const next = new Map(prev);
        next.set(step.id, step.questions.map((q) => ({ ...q, default: null, required: q.required ?? true })));
        return next;
      });
    } finally {
      setLoadingPersonalize(false);
    }
  }, [description, classifyResult]);

  // ── Stage 3: Select archetype and start steps ──

  const handleSelectArchetype = useCallback(async (archetypeId: string) => {
    if (loadingPersonalize || loadingClarify) return; // guard against double-click
    const archetype = getArchetypeById(archetypeId);
    if (!archetype) return;

    setSelectedArchetype(archetype);
    setCurrentStepIndex(0);
    setClarifyQuestions([]);

    setLoadingClarify(true);
    try {
      const result = await api.clarifyWizard({
        description: description.trim(),
        archetypeId: archetype.id,
        detailLevel: classifyResult?.detail_level,
        previousAnswers: {},
      });
      const questions = (result.questions || []).filter((q: any) => !q?.skipped);
      setClarifyQuestions(questions);

      // Auto-apply defaults for clarify questions
      const defaults: Record<string, any> = {};
      for (const q of questions) {
        if (q.default && !answers[q.id]) {
          defaults[q.id] = q.default;
        }
      }
      if (Object.keys(defaults).length > 0) {
        setAnswers((prev) => ({ ...prev, ...defaults }));
      }

      if (questions.length > 0) {
        setStage("clarify");
      } else {
        setStage("steps");
        await personalizeStep(archetype, archetype.steps[0], { ...answers, ...defaults });
      }
    } catch {
      // Fallback: skip clarify and proceed
      setStage("steps");
      await personalizeStep(archetype, archetype.steps[0], answers);
    } finally {
      setLoadingClarify(false);
    }
  }, [loadingPersonalize, loadingClarify, description, classifyResult, answers, personalizeStep]);

  // ── Step navigation ──

  const handleNextStep = useCallback(async () => {
    if (!selectedArchetype) return;
    const nextIndex = currentStepIndex + 1;

    if (nextIndex >= selectedArchetype.steps.length) {
      // All steps done — launch
      handleLaunch();
      return;
    }

    setCurrentStepIndex(nextIndex);
    const nextStep = selectedArchetype.steps[nextIndex];
    if (!personalizedQuestions.has(nextStep.id)) {
      await personalizeStep(selectedArchetype, nextStep, answers);
    }
  }, [selectedArchetype, currentStepIndex, answers, personalizedQuestions, personalizeStep]);

  const handlePrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    } else {
      // Go back to classification
      setStage("classify");
      setSelectedArchetype(null);
    }
  }, [currentStepIndex]);

  const handleFinishClarify = useCallback(async () => {
    if (!selectedArchetype) return;
    setStage("steps");
    const firstStep = selectedArchetype.steps[0];
    if (!personalizedQuestions.has(firstStep.id)) {
      await personalizeStep(selectedArchetype, firstStep, answers);
    }
  }, [selectedArchetype, personalizedQuestions, personalizeStep, answers]);

  const handleBackFromClarify = useCallback(() => {
    setStage("classify");
    setSelectedArchetype(null);
    setClarifyQuestions([]);
  }, []);

  // ── Answer handling ──

  const handleAnswer = useCallback((questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleMultiAnswer = useCallback((questionId: string, option: string) => {
    setAnswers((prev) => {
      const current: string[] = prev[questionId] || [];
      const next = current.includes(option)
        ? current.filter((o: string) => o !== option)
        : [...current, option];
      return { ...prev, [questionId]: next };
    });
  }, []);

  // ── Launch ──

  const setLaunchSteps = useStore((s) => s.setLaunchSteps);

  const handleLaunch = useCallback(async () => {
    if (!selectedArchetype) return;
    setStage("launching");
    setLaunchPhase("brief");

    // Initialize launch pipeline state
    setLaunchSteps({ brief: "active" });

    try {
      const res = await api.launchBrief({
        mode: activeMode,
        archetypeId: selectedArchetype.id,
        archetypeTitle: selectedArchetype.title,
        description: description.trim(),
        answers,
      });

      if (!res.ok || !res.body) {
        setLaunchPhase("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      // Read SSE until we get the slug, then route to /project immediately.
      // Server continues processing CTO in background → WS broadcasts update the live flow.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            try {
              const data = JSON.parse(line.slice(5).trim());
              if (data.slug) {
                setCurrentStage("cto"); // Reset stage so we always see CTO analysis, not a stale stage
                setActiveProjectSlug(data.slug);
                setOsBooted(true);
                setRoute("/project");
                return; // Route away — server continues, WS drives the live flow
              }
            } catch {}
          }
        }
      }
    } catch {
      setLaunchPhase("error");
    }
  }, [selectedArchetype, description, answers, activeMode, setActiveProjectSlug, setOsBooted, setRoute, setLaunchSteps, setCurrentStage]);

  // ── Render stages ──

  // Header with back button
  const header = (
    <div className="flex items-center gap-2 mb-6">
      <IconBtn onClick={onBack} size={32} style={{ color: "rgba(255,255,255,0.7)" }}>
        <Icon d={icons.arrowLeft} size={16} />
      </IconBtn>
      <span className="text-lg font-semibold text-text capitalize">{activeMode === "venture" ? "Startup" : activeMode}</span>
    </div>
  );

  // ── STAGE: Input ──
  if (stage === "input" || stage === "classifying") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6">
        <div key={stage} className="w-full max-w-[640px] stage-enter">
          <IconBtn onClick={onBack} size={32} style={{ color: "rgba(255,255,255,0.7)", marginBottom: 24 }}>
            <Icon d={icons.arrowLeft} size={16} />
          </IconBtn>
          <h2 className="text-2xl font-semibold text-text mb-6" style={{ fontFamily: "var(--font-sans)", letterSpacing: "-0.03em" }}>
            Kadima, Build{" "}
            <RotatingWord words={ADJECTIVES[activeMode]} interval={3500} />{" "}
            {MODE_NOUNS[activeMode]}
          </h2>
          {/* Glass input card */}
          <div className="wizard-card rounded-[28px] p-5 flex flex-col gap-4">
            {expandedBrief ? (
              <div className="flex flex-col gap-3">
                <BriefCard brief={expandedBrief} />
                <button
                  onClick={() => setExpandedBrief(null)}
                  className="self-start flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "var(--color-text-muted)" }}
                >
                  <Icon d={icons.pencil} size={11} />
                  <span style={{ fontSize: 11 }}>Edit</span>
                </button>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => { setDescription(e.target.value); setExpandedBrief(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && stage !== "classifying") { e.preventDefault(); handleClassify(); } }}
                placeholder={PLACEHOLDERS[activeMode]}
                rows={3}
                disabled={stage === "classifying"}
                className="w-full bg-transparent border-none outline-none resize-none text-[15px] text-text placeholder:text-text-muted leading-relaxed disabled:opacity-50"
                style={{ minHeight: 60, maxHeight: 200, fontFamily: "var(--font-sans)" }}
                autoFocus
              />
            )}

            <div className="flex items-center justify-between">
              <div />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <IconBtn
                  onClick={handleExpand}
                  disabled={!description.trim() || expanding || stage === "classifying"}
                  size={34}
                  title="Expand prompt with Opus"
                  className="wand-btn"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  {expanding ? (
                    <Icon d={icons.loader} size={14} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: "translateX(2px)" }}>
                      <path d="M6.53792 2.32172C6.69664 1.89276 7.30336 1.89276 7.46208 2.32172L8.1735 4.2443C8.27331 4.51403 8.48597 4.72669 8.7557 4.8265L10.6783 5.53792C11.1072 5.69664 11.1072 6.30336 10.6783 6.46208L8.7557 7.1735C8.48597 7.27331 8.27331 7.48597 8.1735 7.7557L7.46208 9.67828C7.30336 10.1072 6.69665 10.1072 6.53792 9.67828L5.8265 7.7557C5.72669 7.48597 5.51403 7.27331 5.2443 7.1735L3.32172 6.46208C2.89276 6.30336 2.89276 5.69665 3.32172 5.53792L5.2443 4.8265C5.51403 4.72669 5.72669 4.51403 5.8265 4.2443L6.53792 2.32172Z" stroke="currentColor" strokeWidth="1"/>
                      <path d="M14.4039 9.64136L15.8869 11.1244M6 22H7.49759C8.70997 22 9.31617 22 9.86124 21.7742C10.4063 21.5484 10.835 21.1198 11.6923 20.2625L19.8417 12.1131C20.3808 11.574 20.6503 11.3045 20.7944 11.0137C21.0685 10.4605 21.0685 9.81094 20.7944 9.25772C20.6503 8.96695 20.3808 8.69741 19.8417 8.15832C19.3026 7.61924 19.0331 7.3497 18.7423 7.20561C18.1891 6.93146 17.5395 6.93146 16.9863 7.20561C16.6955 7.3497 16.426 7.61924 15.8869 8.15832L7.73749 16.3077C6.8802 17.165 6.45156 17.5937 6.22578 18.1388C6 18.6838 6 19.29 6 20.5024V22Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </IconBtn>
                <IconBtn
                  onClick={() => handleClassify()}
                  disabled={!description.trim() || stage === "classifying"}
                  size={34}
                  variant="green"
                  className="enter-btn"
                  style={{ color: "rgba(99,241,157,0.55)" }}
                >
                  {stage === "classifying" ? (
                    <Icon d={icons.loader} size={14} stroke="rgba(99,241,157,0.55)" style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <Icon d={icons.play} size={14} fill="rgba(99,241,157,0.55)" stroke="none" />
                  )}
                </IconBtn>
              </div>
            </div>

            {stage === "classifying" && (
              <div className="flex justify-center pt-1">
                <span className="letter-shimmer text-sm font-medium">Analyzing your idea...</span>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                {error}
                <button onClick={() => { setError(null); setStage("input"); }} className="ml-2 underline cursor-pointer">Retry</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── STAGE: Disambiguate ──
  if (stage === "disambiguate" && classifyResult?.disambiguation) {
    const { question, options } = classifyResult.disambiguation;
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6">
        <div key={stage} className="w-full max-w-[640px] stage-enter">
          {header}
          <div className="wizard-card rounded-[28px] p-6 flex flex-col gap-5">
            <p className="text-sm text-text-muted">Help us understand better:</p>
            <h3 className="text-lg font-semibold text-text">{question}</h3>
            <div className="flex flex-col gap-2">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleDisambiguate(opt)}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all cursor-pointer"
                  style={{
                    background: "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 2.45%, rgba(255,255,255,0) 126.14%)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.65)",
                    boxShadow: "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── STAGE: Classify result ──
  if (stage === "classify" && classifyResult) {
    const topConfidence = classifyResult.archetypes[0]?.confidence || 0;
    const preselect = topConfidence >= 0.75;
    const allArchetypes = ARCHETYPES[activeMode];
    const displayArchetypes = showAllArchetypes
      ? allArchetypes.map((a) => {
          const match = classifyResult.archetypes.find((r) => r.id === a.id);
          return { id: a.id, title: a.title, confidence: match?.confidence || 0, description: match?.description || a.description, emoji: a.emoji };
        })
      : classifyResult.archetypes.map((r) => {
          const full = getArchetypeById(r.id);
          return { ...r, emoji: full?.emoji || "" };
        });

    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6">
        <div key={stage} className="w-full max-w-[640px] stage-enter">
          {header}
          <div className="wizard-card rounded-[28px] p-6 flex flex-col gap-4">
            <p className="text-sm text-text-muted">
              {preselect ? "We think this is closest to:" : "Pick the best match:"}
            </p>

            <div className="flex flex-col gap-4">
              {displayArchetypes.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => handleSelectArchetype(a.id)}
                  className="w-full text-left px-4 py-3.5 rounded-xl border transition-all cursor-pointer"
                  style={{
                    background: preselect && i === 0
                      ? "linear-gradient(0deg, rgba(99,241,157,0) 0%, rgba(99,241,157,0.08) 2.45%, rgba(99,241,157,0) 126.14%)"
                      : "transparent",
                    borderColor: preselect && i === 0 ? "rgba(99,241,157,0.35)" : "var(--color-border)",
                    boxShadow: preselect && i === 0
                      ? "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 20px rgba(99,241,157,0.1)"
                      : "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.18) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.18) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: preselect && i === 0 ? "var(--color-accent)" : "var(--color-text-muted)" }} />
                    <span className="font-medium text-sm text-text">
                      {a.title}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mb-2">{a.description}</p>
                  {a.confidence > 0 && <ConfidenceBar value={a.confidence} />}
                </button>
              ))}
            </div>

            {!showAllArchetypes && (
              <button
                onClick={() => setShowAllArchetypes(true)}
                className="text-xs text-text-muted hover:text-accent transition-colors cursor-pointer self-center"
              >
                Show all {activeMode} archetypes
              </button>
            )}

            <button
              onClick={() => { setStage("input"); setClassifyResult(null); setShowAllArchetypes(false); }}
              className="text-xs text-text-muted hover:text-text transition-colors cursor-pointer self-center"
            >
              Edit description
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STAGE: Clarify (domain-specific gaps) ──
  if (stage === "clarify" && selectedArchetype) {
    const questions = clarifyQuestions || [];
    const requiredAnswered = questions.every((q) => {
      if (!q.required) return true;
      const val = answers[q.id];
      if (val === undefined || val === null || val === "") return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    });

    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6">
        <div key={stage} className="w-full max-w-[640px] stage-enter">
          {header}

          <div className="wizard-card rounded-[28px] p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text">Quick Clarify</h3>
              <span className="text-xs text-text-muted">2–3 targeted questions</span>
            </div>

            {loadingClarify ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <span className="letter-shimmer text-sm font-medium">Generating clarifying questions...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {questions.map((q) => (
                  <div key={q.id} className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-text">{q.prompt}</label>

                    {q.type === "select" && q.options && (
                      <div className="flex flex-col gap-2.5">
                        {q.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handleAnswer(q.id, opt)}
                            className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm transition-all cursor-pointer"
                            style={{
                              background: answers[q.id] === opt
                                ? "linear-gradient(0deg, rgba(99,241,157,0) 0%, rgba(99,241,157,0.08) 2.45%, rgba(99,241,157,0) 126.14%)"
                                : "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 2.45%, rgba(255,255,255,0) 126.14%)",
                              border: answers[q.id] === opt ? "1px solid rgba(99,241,157,0.35)" : "1px solid rgba(255,255,255,0.1)",
                              color: answers[q.id] === opt ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)",
                              boxShadow: answers[q.id] === opt
                                ? "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 16px rgba(99,241,157,0.1)"
                                : "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset",
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === "multiselect" && q.options && (
                      <div className="flex flex-wrap gap-1.5">
                        {q.options.map((opt) => {
                          const selected = (answers[q.id] || []).includes(opt);
                          return (
                            <button
                              key={opt}
                              onClick={() => handleMultiAnswer(q.id, opt)}
                              className="px-3 py-2 rounded-lg text-sm transition-all cursor-pointer"
                              style={{
                                background: selected
                                  ? "linear-gradient(0deg, rgba(99,241,157,0) 0%, rgba(99,241,157,0.08) 2.45%, rgba(99,241,157,0) 126.14%)"
                                  : "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 2.45%, rgba(255,255,255,0) 126.14%)",
                                border: selected ? "1px solid rgba(99,241,157,0.35)" : "1px solid rgba(255,255,255,0.1)",
                                color: selected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)",
                                boxShadow: selected
                                  ? "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 16px rgba(99,241,157,0.1)"
                                  : "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset",
                              }}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === "short_text" && (
                      <input
                        type="text"
                        value={answers[q.id] || ""}
                        onChange={(e) => handleAnswer(q.id, e.target.value)}
                        placeholder={q.default || ""}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-transparent text-sm text-text placeholder:text-text-muted outline-none focus:border-accent transition-colors"
                        style={{ fontFamily: "var(--font-sans)" }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleBackFromClarify}
                style={{
                  display: "flex", alignItems: "center",
                  padding: "0 14px", height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(70,70,70,0.3)",
                  boxShadow: "rgba(99,241,157,0.22) -8px -6px 4px -8px inset, rgba(255,255,255,0.2) 6px 6px 4px -5px inset",
                  color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500, cursor: "pointer",
                  transition: "box-shadow 0.15s, background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "rgba(99,241,157,0.35) -8px -6px 4px -8px inset, rgba(255,255,255,0.3) 6px 6px 4px -5px inset"; e.currentTarget.style.background = "rgba(70,70,70,0.38)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "rgba(99,241,157,0.22) -8px -6px 4px -8px inset, rgba(255,255,255,0.2) 6px 6px 4px -5px inset"; e.currentTarget.style.background = "rgba(70,70,70,0.3)"; }}
              >
                Back
              </button>

              <button
                onClick={handleFinishClarify}
                disabled={!requiredAnswered}
                style={{
                  display: "flex", alignItems: "center",
                  padding: "0 16px", height: 32, borderRadius: 8,
                  background: requiredAnswered ? "rgba(99,241,157,0.12)" : "rgba(255,255,255,0.08)",
                  border: requiredAnswered ? "1px solid rgba(99,241,157,0.45)" : "1px solid rgba(255,255,255,0.12)",
                  color: requiredAnswered ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)",
                  fontSize: 13, fontWeight: 600, cursor: requiredAnswered ? "pointer" : "not-allowed",
                  boxShadow: requiredAnswered ? "0 0 16px rgba(99,241,157,0.18)" : "none",
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── STAGE: Steps (dynamic wizard) ──
  if (stage === "steps" && selectedArchetype) {
    const currentStep = selectedArchetype.steps[currentStepIndex];
    const questions = personalizedQuestions.get(currentStep.id) || [];
    const isLastStep = currentStepIndex === selectedArchetype.steps.length - 1;

    // Check if current step questions are answered enough to proceed
    const requiredAnswered = questions.every((q) => {
      if (!q.required) return true;
      const val = answers[q.id];
      if (val === undefined || val === null || val === "") return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    });

    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6">
        <div key={stage} className="w-full max-w-[640px] stage-enter">
          {header}

          <StepIndicator steps={selectedArchetype.steps} currentIndex={currentStepIndex} />

          <div className="wizard-card rounded-[28px] p-6 flex flex-col gap-5">
            <h3 className="text-lg font-semibold text-text">{currentStep.title}</h3>

            {loadingPersonalize ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <span className="letter-shimmer text-sm font-medium">Personalizing questions...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {questions.map((q) => (
                  <div key={q.id} className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-text">{q.prompt}</label>

                    {q.type === "select" && q.options && (
                      <div className="flex flex-col gap-2.5">
                        {q.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handleAnswer(q.id, opt)}
                            className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm transition-all cursor-pointer"
                            style={{
                              background: answers[q.id] === opt
                                ? "linear-gradient(0deg, rgba(99,241,157,0) 0%, rgba(99,241,157,0.08) 2.45%, rgba(99,241,157,0) 126.14%)"
                                : "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 2.45%, rgba(255,255,255,0) 126.14%)",
                              border: answers[q.id] === opt ? "1px solid rgba(99,241,157,0.35)" : "1px solid rgba(255,255,255,0.1)",
                              color: answers[q.id] === opt ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)",
                              boxShadow: answers[q.id] === opt
                                ? "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 16px rgba(99,241,157,0.1)"
                                : "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset",
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === "multiselect" && q.options && (
                      <div className="flex flex-wrap gap-1.5">
                        {q.options.map((opt) => {
                          const selected = (answers[q.id] || []).includes(opt);
                          return (
                            <button
                              key={opt}
                              onClick={() => handleMultiAnswer(q.id, opt)}
                              className="px-3 py-2 rounded-lg text-sm transition-all cursor-pointer"
                              style={{
                                background: selected
                                  ? "linear-gradient(0deg, rgba(99,241,157,0) 0%, rgba(99,241,157,0.08) 2.45%, rgba(99,241,157,0) 126.14%)"
                                  : "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 2.45%, rgba(255,255,255,0) 126.14%)",
                                border: selected ? "1px solid rgba(99,241,157,0.35)" : "1px solid rgba(255,255,255,0.1)",
                                color: selected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)",
                                boxShadow: selected
                                  ? "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 16px rgba(99,241,157,0.1)"
                                  : "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset",
                              }}
                            >
                                                            {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === "short_text" && (
                      <input
                        type="text"
                        value={answers[q.id] || ""}
                        onChange={(e) => handleAnswer(q.id, e.target.value)}
                        placeholder={q.default || ""}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-transparent text-sm text-text placeholder:text-text-muted outline-none focus:border-accent transition-colors"
                        style={{ fontFamily: "var(--font-sans)" }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handlePrevStep}
                style={{
                  display: "flex", alignItems: "center",
                  padding: "0 14px", height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(70,70,70,0.3)",
                  boxShadow: "rgba(99,241,157,0.22) -8px -6px 4px -8px inset, rgba(255,255,255,0.2) 6px 6px 4px -5px inset",
                  color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500, cursor: "pointer",
                  transition: "box-shadow 0.15s, background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "rgba(99,241,157,0.35) -8px -6px 4px -8px inset, rgba(255,255,255,0.3) 6px 6px 4px -5px inset"; e.currentTarget.style.background = "rgba(70,70,70,0.38)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "rgba(99,241,157,0.22) -8px -6px 4px -8px inset, rgba(255,255,255,0.2) 6px 6px 4px -5px inset"; e.currentTarget.style.background = "rgba(70,70,70,0.3)"; }}
              >
                Back
              </button>
              <button
                onClick={handleNextStep}
                disabled={!requiredAnswered || loadingPersonalize}
                style={{
                  display: "flex", alignItems: "center",
                  padding: "0 14px", height: 32, borderRadius: 8, border: "1px solid rgba(99,241,157,0.3)",
                  background: "rgba(99,241,157,0.18)",
                  boxShadow: "rgba(99,241,157,0.5) -8px -6px 4px -8px inset, rgba(255,255,255,0.4) 6px 6px 4px -5px inset, 0 0 10px rgba(99,241,157,0.2) inset",
                  color: "rgba(99,241,157,0.9)", fontSize: 13, fontWeight: 500, cursor: "pointer",
                  transition: "box-shadow 0.15s, background 0.15s",
                  opacity: (!requiredAnswered || loadingPersonalize) ? 0.3 : 1,
                }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.boxShadow = "rgba(99,241,157,0.7) -8px -6px 4px -8px inset, rgba(255,255,255,0.5) 6px 6px 4px -5px inset, 0 0 14px rgba(99,241,157,0.3) inset"; e.currentTarget.style.background = "rgba(99,241,157,0.24)"; } }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "rgba(99,241,157,0.5) -8px -6px 4px -8px inset, rgba(255,255,255,0.4) 6px 6px 4px -5px inset, 0 0 10px rgba(99,241,157,0.2) inset"; e.currentTarget.style.background = "rgba(99,241,157,0.18)"; }}
              >
                {isLastStep ? "Build" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── STAGE: Launching ──
  if (stage === "launching") {
    const phaseLabels: Record<LaunchPhase, string> = {
      brief: "Generating project brief...",
      cto: "CTO is expanding the plan...",
      ready: "Ready!",
      error: "Something went wrong.",
    };

    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6">
        <div key={stage} className="flex flex-col items-center gap-4 stage-enter">
          {launchPhase !== "error" && launchPhase !== "ready" && (
            <Icon d={icons.loader} size={24} style={{ animation: "spin 1s linear infinite", color: "var(--color-accent)" }} />
          )}
          {launchPhase === "ready" && (
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: "var(--color-accent)", color: "var(--color-accent-text)" }}>
              {"\u2713"}
            </div>
          )}
          <span className={`text-sm font-medium ${launchPhase !== "error" && launchPhase !== "ready" ? "letter-shimmer" : "text-text-muted"}`}>
            {phaseLabels[launchPhase]}
          </span>
          {launchPhase === "error" && (
            <button
              onClick={() => { setStage("steps"); setLaunchPhase("brief"); }}
              className="text-xs text-accent hover:underline cursor-pointer"
            >
              Go back and retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
