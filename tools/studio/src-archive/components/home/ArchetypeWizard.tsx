import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Icon, icons } from "@/lib/icons";
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

type Stage = "input" | "classifying" | "classify" | "disambiguate" | "steps" | "launching";

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
            style={{
              backgroundColor: i < currentIndex ? "var(--color-accent)" : i === currentIndex ? "var(--color-accent-soft)" : "var(--color-bg-elevated)",
              color: i < currentIndex ? "var(--color-accent-text)" : i === currentIndex ? "var(--color-accent)" : "var(--color-text-muted)",
              border: i === currentIndex ? "1.5px solid var(--color-accent)" : "1.5px solid transparent",
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

  const [activeMode, setActiveMode] = useState<WizardMode>(initialMode);
  const [stage, setStage] = useState<Stage>("input");
  const [description, setDescription] = useState("");
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [selectedArchetype, setSelectedArchetype] = useState<Archetype | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [personalizedQuestions, setPersonalizedQuestions] = useState<Map<string, PersonalizedQuestion[]>>(new Map());
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loadingPersonalize, setLoadingPersonalize] = useState(false);
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

  // ── Stage 3: Select archetype and start steps ──

  const handleSelectArchetype = useCallback(async (archetypeId: string) => {
    const archetype = getArchetypeById(archetypeId);
    if (!archetype) return;

    setSelectedArchetype(archetype);
    setCurrentStepIndex(0);
    setStage("steps");

    // Personalize first step
    await personalizeStep(archetype, archetype.steps[0], {});
  }, []);

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
  }, [selectedArchetype, description, answers, activeMode, setActiveProjectSlug, setOsBooted, setRoute, setLaunchSteps]);

  // ── Render stages ──

  // Header with back button
  const header = (
    <div className="flex items-center gap-2 mb-6">
      <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-bg-elevated transition-colors cursor-pointer">
        <Icon d={icons.arrowLeft} size={18} />
      </button>
      <span className="text-lg font-semibold text-text capitalize">{activeMode === "venture" ? "Startup" : activeMode}</span>
    </div>
  );

  // ── STAGE: Input ──
  if (stage === "input" || stage === "classifying") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6">
        <div key={stage} className="w-full max-w-[640px] stage-enter">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-bg-elevated transition-colors cursor-pointer mb-6">
            <Icon d={icons.arrowLeft} size={18} />
          </button>
          <h2 className="text-2xl font-semibold text-text mb-6" style={{ fontFamily: "var(--font-sans)", letterSpacing: "-0.03em" }}>
            Kadima, Build{" "}
            <RotatingWord words={ADJECTIVES[activeMode]} interval={3500} />{" "}
            {MODE_NOUNS[activeMode]}
          </h2>
          <div
            className="rounded-2xl border border-border bg-bg-card p-5 flex flex-col gap-4"
            style={{ boxShadow: "0 2px 24px rgba(0,0,0,0.2)" }}
          >
            <textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && stage !== "classifying") { e.preventDefault(); handleClassify(); } }}
              placeholder={PLACEHOLDERS[activeMode]}
              rows={3}
              disabled={stage === "classifying"}
              className="w-full bg-transparent border-none outline-none resize-none text-[15px] text-text placeholder:text-text-muted leading-relaxed disabled:opacity-50"
              style={{ minHeight: 60, maxHeight: 200, fontFamily: "var(--font-sans)" }}
              autoFocus
            />

            <div className="flex items-center justify-between">
              <div />
              <button
                onClick={() => handleClassify()}
                disabled={!description.trim() || stage === "classifying"}
                className="flex items-center justify-center px-2.5 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default"
                style={{ backgroundColor: "var(--color-accent)" }}
              >
                {stage === "classifying" ? (
                  <Icon d={icons.loader} size={14} stroke="var(--color-bg)" style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <Icon d={icons.play} size={14} fill="var(--color-bg)" stroke="none" />
                )}
              </button>
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
          <div className="rounded-2xl border border-border bg-bg-card p-6 flex flex-col gap-5" style={{ boxShadow: "0 2px 24px rgba(0,0,0,0.2)" }}>
            <p className="text-sm text-text-muted">Help us understand better:</p>
            <h3 className="text-lg font-semibold text-text">{question}</h3>
            <div className="flex flex-col gap-2">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleDisambiguate(opt)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-accent hover:bg-accent/5 text-sm text-text transition-all cursor-pointer"
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
          <div className="rounded-2xl border border-border bg-bg-card p-6 flex flex-col gap-4" style={{ boxShadow: "0 2px 24px rgba(0,0,0,0.2)" }}>
            <p className="text-sm text-text-muted">
              {preselect ? "We think this is closest to:" : "Pick the best match:"}
            </p>

            <div className="flex flex-col gap-2">
              {displayArchetypes.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => handleSelectArchetype(a.id)}
                  className="w-full text-left px-4 py-3.5 rounded-xl border transition-all cursor-pointer"
                  style={{
                    borderColor: preselect && i === 0 ? "var(--color-accent)" : "var(--color-border)",
                    backgroundColor: preselect && i === 0 ? "var(--color-accent-soft)" : "transparent",
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

          <div className="rounded-2xl border border-border bg-bg-card p-6 flex flex-col gap-5" style={{ boxShadow: "0 2px 24px rgba(0,0,0,0.2)" }}>
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
                      <div className="flex flex-col gap-1.5">
                        {q.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handleAnswer(q.id, opt)}
                            className="w-full text-left px-3.5 py-2.5 rounded-lg border text-sm transition-all cursor-pointer"
                            style={{
                              borderColor: answers[q.id] === opt ? "var(--color-accent)" : "var(--color-border)",
                              backgroundColor: answers[q.id] === opt ? "var(--color-accent-soft)" : "transparent",
                              color: answers[q.id] === opt ? "var(--color-text)" : "var(--color-text-muted)",
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
                              className="px-3 py-2 rounded-lg border text-sm transition-all cursor-pointer"
                              style={{
                                borderColor: selected ? "var(--color-accent)" : "var(--color-border)",
                                backgroundColor: selected ? "var(--color-accent-soft)" : "transparent",
                                color: selected ? "var(--color-text)" : "var(--color-text-muted)",
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
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text hover:bg-bg-elevated transition-colors cursor-pointer"
              >
                <Icon d={icons.chevronLeft} size={14} />
                Back
              </button>
              <button
                onClick={handleNextStep}
                disabled={!requiredAnswered || loadingPersonalize}
                className="btn-shimmer flex items-center gap-1.5 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default"
                style={{ backgroundColor: "var(--color-accent)", color: "var(--color-accent-text)" }}
              >
                {isLastStep ? "Build" : "Next"}
                <Icon d={icons.chevronRight} size={14} />
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
