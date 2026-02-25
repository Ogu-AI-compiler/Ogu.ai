import { useEffect, useState, useRef } from "react";
import { YStack, XStack, Text, Separator } from "tamagui";
import { api } from "@/lib/api";
import { Icon, icons } from "@/lib/icons";
import { useSocket } from "@/hooks/useSocket";

type Mode = "references" | "dna" | null;

export function BrandView() {
  const [mode, setMode] = useState<Mode>(null);
  const { on } = useSocket();

  // ── References state ──
  const [urls, setUrls] = useState<string[]>([]);
  const [images, setImages] = useState<{ name: string; path: string }[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── References analyze state ──
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeJobId, setAnalyzeJobId] = useState<string | null>(null);
  const [analyzeOutput, setAnalyzeOutput] = useState<string[]>([]);
  const [reference, setReference] = useState<any>(null);
  const analyzeOutputRef = useRef<HTMLDivElement>(null);

  // ── DNA state ──
  const [dnaUrl, setDnaUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanJobId, setScanJobId] = useState<string | null>(null);
  const [scanOutput, setScanOutput] = useState<string[]>([]);
  const [activeBrand, setActiveBrand] = useState<any>(null);
  const [logos, setLogos] = useState<{ name: string; url: string }[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);

  // Load saved data on mount
  useEffect(() => {
    api.getBrandInput().catch(() => ({ urls: [], images: [] })).then((input) => {
      setUrls(input?.urls || []);
      setImages(input?.images || []);
    });
    api.getBrandScans().catch(() => []).then((b) => {
      // Show the most recent scan
      if (b && b.length > 0) {
        const latest = b.sort((a: any, b: any) =>
          new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime()
        )[0];
        setActiveBrand(latest);
        if (latest?.domain) {
          api.getBrandLogos(latest.domain).catch(() => []).then((l) => setLogos(l || []));
        }
      }
    });
    api.getReference().catch(() => null).then((r) => setReference(r));
  }, []);

  // Listen for scan output via WebSocket
  useEffect(() => {
    if (!scanJobId) return;
    const unsub1 = on("command:output", (e: any) => {
      if (e.jobId !== scanJobId) return;
      setScanOutput((prev) => [...prev, e.data]);
      setTimeout(() => outputRef.current?.scrollTo(0, outputRef.current.scrollHeight), 50);
    });
    const unsub2 = on("command:complete", (e: any) => {
      if (e.jobId !== scanJobId) return;
      setScanning(false);
      setScanJobId(null);
      // Refresh brand scans and show latest
      api.getBrandScans().catch(() => []).then((b) => {
        if (b && b.length > 0) {
          const latest = b.sort((a: any, bb: any) =>
            new Date(bb.scanned_at).getTime() - new Date(a.scanned_at).getTime()
          )[0];
          setActiveBrand(latest);
          if (latest?.domain) {
            api.getBrandLogos(latest.domain).catch(() => []).then((l) => setLogos(l || []));
          }
        }
      });
    });
    return () => { unsub1(); unsub2(); };
  }, [scanJobId, on]);

  // Listen for analyze output via WebSocket
  useEffect(() => {
    if (!analyzeJobId) return;
    const unsub1 = on("command:output", (e: any) => {
      if (e.jobId !== analyzeJobId) return;
      setAnalyzeOutput((prev) => [...prev, e.data]);
      setTimeout(() => analyzeOutputRef.current?.scrollTo(0, analyzeOutputRef.current.scrollHeight), 50);
    });
    const unsub2 = on("command:complete", (e: any) => {
      if (e.jobId !== analyzeJobId) return;
      setAnalyzing(false);
      setAnalyzeJobId(null);
      api.getReference().catch(() => null).then((r) => setReference(r));
    });
    return () => { unsub1(); unsub2(); };
  }, [analyzeJobId, on]);

  // ── References handlers ──
  function addUrl() {
    const u = urlInput.trim();
    if (!u) return;
    const normalized = u.startsWith("http") ? u : `https://${u}`;
    if (urls.includes(normalized)) return;
    setUrls((prev) => [...prev, normalized]);
    setUrlInput("");
    setSaved(false);
  }

  function removeUrl(idx: number) {
    setUrls((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  }

  async function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files).filter((f) => f.type.startsWith("image/"))) {
      try {
        const result = await api.uploadBrandImage(file);
        setImages((prev) => [...prev, result]);
        setSaved(false);
      } catch { /* skip */ }
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.saveBrandInput({ urls, images });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function startAnalyze() {
    if (urls.length < 2) return;
    await api.saveBrandInput({ urls, images }).catch(() => {});
    setAnalyzing(true);
    setAnalyzeOutput([]);
    try {
      const { jobId } = await api.scanReference(urls);
      setAnalyzeJobId(jobId);
    } catch {
      setAnalyzing(false);
      setAnalyzeOutput(["  ERROR  Failed to start analysis"]);
    }
  }

  // ── DNA handlers ──
  async function startScan() {
    const u = dnaUrl.trim();
    if (!u) return;
    const normalized = u.startsWith("http") ? u : `https://${u}`;
    setScanning(true);
    setScanOutput([]);
    setLogos([]);
    setActiveBrand(null);
    try {
      const { jobId } = await api.scanBrand(normalized);
      setScanJobId(jobId);
    } catch {
      setScanning(false);
      setScanOutput(["  ERROR  Failed to start scan"]);
    }
  }

  const subtitle = mode === "references"
    ? "Add reference URLs and images for design inspiration"
    : mode === "dna"
    ? "Scan your website to extract brand identity"
    : "Choose how you want to guide Ogu's design direction";

  return (
    <YStack flex={1} padding="$7" gap="$6" overflow="scroll">
      {/* Header */}
      <YStack gap="$2">
        <Text fontSize="$7" fontWeight="700" letterSpacing={-0.5} style={{ color: "var(--text)" }}>
          Brand & Design
        </Text>
        <Text fontSize="$4" style={{ color: "var(--text-secondary)" }}>
          {subtitle}
        </Text>
      </YStack>

      {/* ── Mode Selection Cards ── */}
      <div style={{ display: "flex", gap: 16 }}>
        <ModeCard
          icon={icons.sparkles}
          title="References"
          desc="Get inspired by other websites and designs"
          active={mode === "references"}
          onClick={() => setMode(mode === "references" ? null : "references")}
        />
        <ModeCard
          icon={icons.fingerprint}
          title="Brand DNA"
          desc="Help Ogu understand your brand identity"
          active={mode === "dna"}
          onClick={() => setMode(mode === "dna" ? null : "dna")}
        />
      </div>

      {/* ── References Section ── */}
      {mode === "references" && (
        <YStack gap="$5" style={{
          padding: 20, borderRadius: 12,
          backgroundColor: "var(--bg-card)", border: "1px solid var(--border)",
        }}>
          {/* URL Input */}
          <YStack gap="$3">
            <Text fontSize="$2" fontWeight="500" style={{ color: "var(--text-secondary)" }}>
              Reference URLs
            </Text>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUrl()}
                placeholder="https://dribbble.com/shots/..."
                style={inputStyle}
              />
              <button onClick={addUrl} style={btnSmall("var(--accent)")}>
                <Icon d={icons.plus} size={16} stroke="#0a0a0f" />
              </button>
            </div>
            {urls.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {urls.map((url, i) => (
                  <Chip key={i} label={url} onRemove={() => removeUrl(i)}
                    icon={<Icon d={icons.globe} size={12} stroke="var(--text-secondary)" />} />
                ))}
              </div>
            )}
          </YStack>

          {/* Image Upload */}
          <YStack gap="$3">
            <Text fontSize="$2" fontWeight="500" style={{ color: "var(--text-secondary)" }}>
              Reference Images
            </Text>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                padding: "32px 16px", borderRadius: 12,
                backgroundColor: "var(--bg)",
                border: `1px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 8, cursor: "pointer",
                transition: "border-color 0.15s",
              }}
            >
              <Icon d={icons.image} size={24} stroke="var(--text-muted)" />
              <span style={{ fontFamily: "var(--font)", fontSize: 13, color: "var(--text-muted)" }}>
                Drop images here or click to browse
              </span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden
              onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }} />
            {images.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {images.map((img, i) => (
                  <ThumbSmall key={i} src={`/api/brand/input/image/${encodeURIComponent(img.name)}`}
                    name={img.name} onRemove={() => removeImage(i)} />
                ))}
              </div>
            )}
          </YStack>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={handleSave} disabled={saving} style={{
              ...btnPrimary(saved ? "var(--success)" : "var(--accent)"),
              opacity: saving ? 0.6 : 1, cursor: saving ? "wait" : "pointer",
            }}>
              <Icon d={icons.check} size={14} stroke="#0a0a0f" />
              {saved ? "Saved" : saving ? "Saving..." : "Save"}
            </button>
            <button onClick={startAnalyze} disabled={analyzing || urls.length < 2}
              style={{
                ...btnPrimary("var(--bg)"), border: "1px solid var(--border)",
                color: "var(--text)",
                opacity: analyzing || urls.length < 2 ? 0.4 : 1,
                cursor: analyzing || urls.length < 2 ? "default" : "pointer",
              }}>
              <Icon d={icons.search} size={14} stroke="var(--text)" />
              <span style={{ color: "var(--text)" }}>{analyzing ? "Analyzing..." : "Analyze"}</span>
            </button>
            {urls.length > 0 && urls.length < 2 && (
              <span style={{ fontFamily: "var(--font)", fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>
                Add at least 2 URLs to analyze
              </span>
            )}
          </div>

          {/* Analyze output */}
          {analyzeOutput.length > 0 && <TermOutput ref={analyzeOutputRef} lines={analyzeOutput} />}

          {/* Reference composite */}
          {reference?.composite && <ReferenceComposite data={reference.composite} />}
        </YStack>
      )}

      {/* ── Brand DNA Section ── */}
      {mode === "dna" && (
        <YStack gap="$5">
          {/* Show input only when no brand scanned yet, or during scanning */}
          {(!activeBrand || scanning) && (
            <div style={{
              display: "flex", gap: 8, padding: 20, borderRadius: 12,
              backgroundColor: "var(--bg-card)", border: "1px solid var(--border)",
            }}>
              <input
                value={dnaUrl}
                onChange={(e) => setDnaUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !scanning && startScan()}
                placeholder="https://your-brand.com"
                disabled={scanning}
                style={{ ...inputStyle, opacity: scanning ? 0.6 : 1 }}
              />
              <button onClick={startScan} disabled={scanning || !dnaUrl.trim()}
                style={{
                  ...btnSmall("var(--accent)"),
                  opacity: scanning || !dnaUrl.trim() ? 0.5 : 1,
                  cursor: scanning || !dnaUrl.trim() ? "default" : "pointer",
                  gap: 6, paddingLeft: 14, paddingRight: 14,
                }}>
                <Icon d={scanning ? icons.loader : icons.search} size={14} stroke="#0a0a0f" />
                <span style={{ fontFamily: "var(--font)", fontSize: 13, fontWeight: 600, color: "#0a0a0f" }}>
                  {scanning ? "Scanning..." : "Scan"}
                </span>
              </button>
            </div>
          )}

          {/* Scan progress */}
          {scanning && scanOutput.length > 0 && <TermOutput ref={outputRef} lines={scanOutput} />}

          {/* ── Brand DNA Result Card ── */}
          {activeBrand && !scanning && (
            <>
              <BrandDnaCard brand={activeBrand} logos={logos} />
              <button
                onClick={() => { setActiveBrand(null); setDnaUrl(""); setScanOutput([]); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: "var(--font)", fontSize: 12, color: "var(--text-muted)",
                  display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
                  padding: "4px 0",
                }}
                onMouseOver={(e) => { e.currentTarget.style.color = "var(--text)"; }}
                onMouseOut={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                <Icon d={icons.search} size={12} stroke="currentColor" />
                Scan another website
              </button>
            </>
          )}
        </YStack>
      )}
    </YStack>
  );
}

/* ══════════════════════════════════════════════════════════════
   Brand DNA Result Card — Pomeli-inspired layout
   ══════════════════════════════════════════════════════════════ */

function BrandDnaCard({ brand, logos }: { brand: any; logos: { name: string; url: string }[] }) {
  const c = brand.colors || {};
  const t = brand.typography || {};
  const tone = brand.brand_tone?.tone_markers || [];
  const domain = brand.domain || "";
  const framework = brand.detected_framework;
  const dm = brand.dark_mode || {};
  const lang = brand.language || {};

  // State for toggling light/dark color palettes
  const [showDarkPalette, setShowDarkPalette] = useState(false);

  // Pick the main colors to display as circles (dedup same hex values)
  // When showDarkPalette is true and dark mode colors exist, use those instead
  const activePalette = showDarkPalette && dm.has_dark_mode && Object.keys(dm.colors || {}).length > 0
    ? { ...c, ...dm.colors } : c;

  const rawColors = [
    { hex: activePalette.primary, label: "Primary" },
    { hex: activePalette.secondary, label: "Secondary" },
    { hex: activePalette.accent || activePalette.surface, label: activePalette.accent ? "Accent" : "Surface" },
    { hex: activePalette.text, label: "Text" },
    { hex: activePalette.background, label: "Background" },
  ].filter((x) => x.hex);
  const colorCircles: { hex: string; label: string }[] = [];
  const seenHex = new Map<string, number>();
  for (const item of rawColors) {
    const key = item.hex.toLowerCase();
    if (seenHex.has(key)) {
      const idx = seenHex.get(key)!;
      colorCircles[idx].label += ` / ${item.label}`;
    } else {
      seenHex.set(key, colorCircles.length);
      colorCircles.push({ ...item });
    }
  }

  // Build logo list from brand JSON logos with data_uri
  const brandLogos = (brand.logos || []).filter((l: any) => l.data_uri);
  // Fallback: use API logos if no data_uri available
  const allLogos = brandLogos.length > 0
    ? brandLogos.map((l: any) => ({ name: l.name, url: l.data_uri, source: l.source }))
    : logos.length > 0
      ? logos
      : (brand.logos || []).map((l: any) => ({ name: l.name, url: `/api/brand/logos/${domain}/${l.name}` }));

  // Find best logo: prefer "logo" in name, then any non-favicon/og, then og-image, then first
  const mainLogo = allLogos.find((l: any) => l.name.startsWith("logo"))
    || allLogos.find((l: any) => !l.name.includes("favicon") && !l.name.includes("og-"))
    || allLogos.find((l: any) => l.name.includes("og-"))
    || allLogos[0];

  const hasDarkToggle = dm.has_dark_mode && Object.keys(dm.colors || {}).length > 0;

  return (
    <div style={{
      borderRadius: 16, overflow: "hidden",
      backgroundColor: "var(--bg-card)", border: "1px solid var(--border)",
    }}>
      {/* ── Top section: Name + Logo + Fonts ── */}
      <div style={{ display: "flex", gap: 0 }}>
        {/* Left: Brand info */}
        <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Domain / Name + Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Logo next to name */}
            {mainLogo && (
              <img src={mainLogo.url} alt="Logo"
                style={{ width: 44, height: 44, objectFit: "contain", flexShrink: 0 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <div>
              <div style={{
                fontFamily: "var(--font)", fontSize: 26, fontWeight: 700,
                color: "var(--text)", letterSpacing: -0.5, marginBottom: 4,
                textTransform: "capitalize",
              }}>
                {domain.split(".")[0]}
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                fontFamily: "var(--font)", fontSize: 12, color: "var(--text-muted)",
              }}>
                <Icon d={icons.globe} size={12} stroke="var(--text-muted)" />
                {domain}
                {framework && (
                  <span style={{
                    marginLeft: 8, padding: "2px 8px", borderRadius: 4,
                    backgroundColor: "var(--bg)", fontSize: 10, color: "var(--text-secondary)",
                  }}>{framework}</span>
                )}
              </div>
            </div>
          </div>

          {/* Fonts */}
          <div>
            <div style={{
              fontFamily: "var(--font)", fontSize: 11, fontWeight: 500,
              color: "var(--text-muted)", textTransform: "uppercase",
              letterSpacing: 0.5, marginBottom: 12,
            }}>Fonts</div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {t.font_body && (
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontSize: 32, fontWeight: 400, color: "var(--text)",
                    fontFamily: `"${t.font_body}", var(--font)`, lineHeight: 1.1, marginBottom: 6,
                  }}>Aa</div>
                  <div style={{
                    fontFamily: "var(--font)", fontSize: 11, color: "var(--text-secondary)",
                  }}>{t.font_body}</div>
                </div>
              )}
              {t.font_heading && t.font_heading !== t.font_body && (
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontSize: 32, fontWeight: 700, color: "var(--text)",
                    fontFamily: `"${t.font_heading}", var(--font)`, lineHeight: 1.1, marginBottom: 6,
                  }}>Aa</div>
                  <div style={{
                    fontFamily: "var(--font)", fontSize: 11, color: "var(--text-secondary)",
                  }}>{t.font_heading}</div>
                </div>
              )}
              {t.font_mono && (
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontSize: 32, fontWeight: 400, color: "var(--text)",
                    fontFamily: `"${t.font_mono}", monospace`, lineHeight: 1.1, marginBottom: 6,
                  }}>Aa</div>
                  <div style={{
                    fontFamily: "var(--font)", fontSize: 11, color: "var(--text-secondary)",
                  }}>{t.font_mono}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Colors section ── */}
      <div style={{
        padding: "20px 28px 28px", borderTop: "1px solid var(--border)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
        }}>
          <div style={{
            fontFamily: "var(--font)", fontSize: 11, fontWeight: 500,
            color: "var(--text-muted)", textTransform: "uppercase",
            letterSpacing: 0.5,
          }}>Colors</div>

          {/* Light / Dark toggle */}
          {hasDarkToggle && (
            <div style={{
              display: "flex", borderRadius: 6, overflow: "hidden",
              border: "1px solid var(--border)",
            }}>
              <button
                onClick={() => setShowDarkPalette(false)}
                style={{
                  padding: "3px 10px", border: "none", cursor: "pointer",
                  fontFamily: "var(--font)", fontSize: 10, fontWeight: 500,
                  backgroundColor: !showDarkPalette ? "var(--accent)" : "var(--bg)",
                  color: !showDarkPalette ? "#0a0a0f" : "var(--text-muted)",
                  transition: "all 0.15s",
                }}
              >{c.is_dark_mode ? "Dark" : "Light"}</button>
              <button
                onClick={() => setShowDarkPalette(true)}
                style={{
                  padding: "3px 10px", border: "none", cursor: "pointer",
                  fontFamily: "var(--font)", fontSize: 10, fontWeight: 500,
                  backgroundColor: showDarkPalette ? "var(--accent)" : "var(--bg)",
                  color: showDarkPalette ? "#0a0a0f" : "var(--text-muted)",
                  transition: "all 0.15s",
                }}
              >{c.is_dark_mode ? "Light" : "Dark"}</button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          {colorCircles.map(({ hex, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: hex,
                border: isLight(hex) ? "1px solid var(--border)" : "none",
                margin: "0 auto 8px",
                transition: "background-color 0.2s",
              }} />
              <div style={{
                fontFamily: "var(--font)", fontSize: 11, fontWeight: 500,
                color: "var(--text-secondary)", marginBottom: 2,
              }}>{label}</div>
              <div style={{
                fontFamily: "var(--font-mono, var(--font))", fontSize: 10,
                color: "var(--text-muted)", textTransform: "uppercase",
              }}>{hex}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Components section (button, card, input) ── */}
      {brand.components && (brand.components.button?.primary || brand.components.card || brand.components.input) && (
        <div style={{ padding: "20px 28px 28px", borderTop: "1px solid var(--border)" }}>
          <div style={{
            fontFamily: "var(--font)", fontSize: 11, fontWeight: 500,
            color: "var(--text-muted)", textTransform: "uppercase",
            letterSpacing: 0.5, marginBottom: 16,
          }}>Components</div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
            {/* Button preview */}
            {brand.components.button?.primary && (() => {
              const btn = brand.components.button.primary;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font)" }}>Button</div>
                  <div style={{
                    backgroundColor: btn.backgroundColor,
                    color: btn.color,
                    borderRadius: btn.borderRadius || "8px",
                    padding: btn.padding || "10px 20px",
                    fontSize: btn.fontSize || "14px",
                    fontWeight: btn.fontWeight || "600",
                    fontFamily: "var(--font)",
                    border: btn.border && !btn.border.startsWith("0px") ? btn.border : "none",
                    boxShadow: btn.boxShadow || "none",
                    display: "inline-block",
                    whiteSpace: "nowrap" as const,
                  }}>
                    Primary
                  </div>
                  <div style={{ fontFamily: "var(--font-mono, var(--font))", fontSize: 9, color: "var(--text-muted)" }}>
                    r: {btn.borderRadius}
                  </div>
                </div>
              );
            })()}
            {/* Secondary button preview */}
            {brand.components.button?.secondary && (() => {
              const btn = brand.components.button.secondary;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font)" }}>Secondary</div>
                  <div style={{
                    backgroundColor: btn.backgroundColor,
                    color: btn.color,
                    borderRadius: btn.borderRadius || "8px",
                    padding: btn.padding || "10px 20px",
                    fontSize: btn.fontSize || "14px",
                    fontWeight: btn.fontWeight || "600",
                    fontFamily: "var(--font)",
                    border: btn.border && !btn.border.startsWith("0px") ? btn.border : "none",
                    boxShadow: btn.boxShadow || "none",
                    display: "inline-block",
                    whiteSpace: "nowrap" as const,
                  }}>
                    Secondary
                  </div>
                </div>
              );
            })()}
            {/* Card preview */}
            {brand.components.card && (() => {
              const card = brand.components.card;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font)" }}>Card</div>
                  <div style={{
                    backgroundColor: card.backgroundColor,
                    borderRadius: card.borderRadius || "12px",
                    padding: "16px 20px",
                    border: card.border && !card.border.startsWith("0px") ? card.border : "1px solid var(--border)",
                    boxShadow: card.boxShadow || "none",
                    width: 120, minHeight: 64,
                    fontFamily: "var(--font)", fontSize: 10, color: "var(--text-muted)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    Card
                  </div>
                  <div style={{ fontFamily: "var(--font-mono, var(--font))", fontSize: 9, color: "var(--text-muted)" }}>
                    r: {card.borderRadius}
                  </div>
                </div>
              );
            })()}
            {/* Input preview */}
            {brand.components.input && (() => {
              const inp = brand.components.input;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font)" }}>Input</div>
                  <input disabled placeholder="Input" style={{
                    backgroundColor: inp.backgroundColor,
                    borderRadius: inp.borderRadius || "8px",
                    padding: inp.padding || "10px 14px",
                    border: inp.border || "1px solid var(--border)",
                    fontSize: inp.fontSize || "14px",
                    color: inp.color || "var(--text)",
                    fontFamily: "var(--font)",
                    width: 140, outline: "none",
                  }} />
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Shadows section ── */}
      {brand.shadows && Object.keys(brand.shadows).length > 0 && (
        <div style={{ padding: "20px 28px 28px", borderTop: "1px solid var(--border)" }}>
          <div style={{
            fontFamily: "var(--font)", fontSize: 11, fontWeight: 500,
            color: "var(--text-muted)", textTransform: "uppercase",
            letterSpacing: 0.5, marginBottom: 16,
          }}>Shadows</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {Object.entries(brand.shadows).map(([size, value]) => (
              <div key={size} style={{ textAlign: "center" }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 8,
                  backgroundColor: "var(--bg-card)",
                  boxShadow: value as string,
                  margin: "0 auto 8px",
                  border: "1px solid var(--border)",
                }} />
                <div style={{ fontFamily: "var(--font)", fontSize: 11, color: "var(--text-secondary)" }}>{size}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Type Scale section ── */}
      {t.type_scale && Object.keys(t.type_scale).length > 0 && (
        <div style={{ padding: "20px 28px 28px", borderTop: "1px solid var(--border)" }}>
          <div style={{
            fontFamily: "var(--font)", fontSize: 11, fontWeight: 500,
            color: "var(--text-muted)", textTransform: "uppercase",
            letterSpacing: 0.5, marginBottom: 16,
          }}>Type Scale</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(t.type_scale).map(([level, vals]: [string, any]) => (
              <div key={level} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <div style={{
                  width: 36, fontFamily: "var(--font)", fontSize: 10,
                  color: "var(--text-muted)", textTransform: "uppercase", flexShrink: 0,
                }}>{level}</div>
                <div style={{
                  fontFamily: `"${vals.fontFamily || t.font_body || 'var(--font)'}"`,
                  fontSize: vals.fontSize, fontWeight: vals.fontWeight,
                  lineHeight: vals.lineHeight,
                  color: "var(--text)", whiteSpace: "nowrap" as const,
                  overflow: "hidden", textOverflow: "ellipsis", maxWidth: 300,
                }}>
                  {level === "body" || level === "small" || level === "caption" ? "The quick brown fox" : `Heading ${level.toUpperCase()}`}
                </div>
                <div style={{
                  fontFamily: "var(--font-mono, var(--font))", fontSize: 9,
                  color: "var(--text-muted)", flexShrink: 0,
                }}>
                  {vals.fontSize} / {vals.fontWeight}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Font files indicator ── */}
      {t.font_files?.length > 0 && (
        <div style={{
          padding: "12px 28px", borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: "var(--font)", fontSize: 11,
        }}>
          <Icon d={icons.check} size={12} stroke="var(--success, #22c55e)" />
          <span style={{ color: "var(--success, #22c55e)" }}>{t.font_files.length} font file(s) downloaded</span>
          {t.font_face_css && (
            <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
              + @font-face CSS ready
            </span>
          )}
        </div>
      )}

      {/* ── Tone & Details ── */}
      {(tone.length > 0 || c.is_dark_mode != null || brand.icons?.length > 0 || lang.lang) && (
        <div style={{
          padding: "16px 28px 24px", borderTop: "1px solid var(--border)",
          display: "flex", gap: 32, flexWrap: "wrap",
        }}>
          {lang.lang && (
            <div>
              <div style={detailLabel}>Language</div>
              <div style={detailValue}>
                {lang.lang_name}
                {lang.dir === "rtl" && (
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}> (RTL)</span>
                )}
              </div>
            </div>
          )}
          {c.is_dark_mode != null && (
            <div>
              <div style={detailLabel}>Mode</div>
              <div style={detailValue}>
                {c.is_dark_mode ? "Dark" : "Light"}
                {dm.has_dark_mode && (
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                    {" "}+ {c.is_dark_mode ? "light" : "dark"}
                  </span>
                )}
              </div>
            </div>
          )}
          {brand.icons?.length > 0 && (
            <div>
              <div style={detailLabel}>Icons</div>
              <div style={detailValue}>{brand.icons.join(", ")}</div>
            </div>
          )}
          {tone.length > 0 && (
            <div>
              <div style={detailLabel}>Tone</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {tone.map((t: string) => (
                  <span key={t} style={{
                    padding: "3px 10px", borderRadius: 4,
                    backgroundColor: "var(--bg)",
                    fontFamily: "var(--font)", fontSize: 11, color: "var(--text-secondary)",
                  }}>{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Reference Composite (for References mode)
   ══════════════════════════════════════════════════════════════ */

function ReferenceComposite({ data }: { data: any }) {
  // Support v3 (nested base/extended) and v2 (flat hex strings)
  const c = data.colors?.base || data.colors || {};
  const colorCircles = [
    { hex: c.primary?.value || c.primary, label: "Primary" },
    { hex: c.secondary?.value || c.secondary, label: "Secondary" },
    { hex: c.background?.value || c.background, label: "Background" },
    { hex: c.text?.value || c.text, label: "Text" },
  ].filter((x) => x.hex && typeof x.hex === "string");

  return (
    <div style={{
      padding: 20, borderRadius: 12,
      backgroundColor: "var(--bg)", border: "1px solid var(--border)",
    }}>
      <div style={{
        fontFamily: "var(--font)", fontSize: 13, fontWeight: 600,
        color: "var(--text)", marginBottom: 16,
      }}>Design Composite</div>

      {colorCircles.length > 0 && (
        <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
          {colorCircles.map(({ hex, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: hex,
                border: isLight(hex) ? "1px solid var(--border)" : "none",
                margin: "0 auto 6px",
              }} />
              <div style={{ fontFamily: "var(--font)", fontSize: 10, color: "var(--text-muted)" }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {data.typography && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          {data.typography.font_body && (
            <span style={tagStyle}>Body: {data.typography.font_body}</span>
          )}
          {data.typography.font_heading && (
            <span style={tagStyle}>Heading: {data.typography.font_heading}</span>
          )}
        </div>
      )}

      {data.tone_markers?.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {data.tone_markers.map((t: string) => (
            <span key={t} style={tagStyle}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Shared sub-components
   ══════════════════════════════════════════════════════════════ */

function ModeCard({ icon, title, desc, active, onClick }: {
  icon: string; title: string; desc: string; active: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, padding: 20, borderRadius: 12, cursor: "pointer",
        backgroundColor: active ? "color-mix(in srgb, var(--accent) 8%, var(--bg-card))" : "var(--bg-card)",
        border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
        display: "flex", flexDirection: "column", gap: 10,
        transition: "border-color 0.15s, background-color 0.15s",
      }}
      onMouseOver={(e) => { if (!active) e.currentTarget.style.borderColor = "var(--text-muted)"; }}
      onMouseOut={(e) => { if (!active) e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: active ? "var(--accent)" : "var(--bg-input)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background-color 0.15s",
      }}>
        <Icon d={icon} size={18} stroke={active ? "#0a0a0f" : "var(--text-secondary)"} />
      </div>
      <div>
        <div style={{
          fontFamily: "var(--font)", fontSize: 15, fontWeight: 600,
          color: "var(--text)", marginBottom: 4,
        }}>{title}</div>
        <div style={{
          fontFamily: "var(--font)", fontSize: 12, color: "var(--text-secondary)",
          lineHeight: 1.4,
        }}>{desc}</div>
      </div>
    </div>
  );
}

function Chip({ label, onRemove, icon }: {
  label: string; onRemove: () => void; icon?: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 12px", borderRadius: 6,
      backgroundColor: "var(--bg-card)", border: "1px solid var(--border)",
      fontFamily: "var(--font)", fontSize: 12,
    }}>
      {icon}
      <span style={{
        color: "var(--text)", maxWidth: 240,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{label}</span>
      <span onClick={onRemove} style={{ cursor: "pointer", display: "inline-flex" }}>
        <Icon d={icons.x} size={12} stroke="var(--text-secondary)" />
      </span>
    </div>
  );
}

function ThumbSmall({ src, name, onRemove }: {
  src: string; name: string; onRemove: () => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <span onClick={onRemove} style={{
        position: "absolute", top: -6, right: -6, zIndex: 1,
        width: 18, height: 18, borderRadius: 9,
        backgroundColor: "var(--error)", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
      }}>
        <Icon d={icons.x} size={10} stroke="white" />
      </span>
      <img src={src} alt={name} style={{
        width: 60, height: 60, objectFit: "cover",
        borderRadius: 8, border: "1px solid var(--border)",
      }} />
      <div style={{
        fontFamily: "var(--font)", fontSize: 10, color: "var(--text-muted)",
        maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis",
        whiteSpace: "nowrap", marginTop: 4,
      }}>{name}</div>
    </div>
  );
}

const TermOutput = ({ ref, lines }: { ref: React.Ref<HTMLDivElement>; lines: string[] }) => (
  <div ref={ref} style={{
    maxHeight: 180, overflowY: "auto", padding: 12, borderRadius: 8,
    backgroundColor: "var(--bg)", border: "1px solid var(--border)",
    fontFamily: "var(--font-mono, var(--font))", fontSize: 11,
    color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.5,
  }}>
    {lines.join("")}
  </div>
);

/* ══════════════════════════════════════════════════════════════
   Style helpers
   ══════════════════════════════════════════════════════════════ */

const inputStyle: React.CSSProperties = {
  flex: 1, padding: "10px 14px",
  fontFamily: "var(--font)", fontSize: 13,
  backgroundColor: "var(--bg)", color: "var(--text)",
  border: "1px solid var(--border)", borderRadius: 8, outline: "none",
};

const detailLabel: React.CSSProperties = {
  fontFamily: "var(--font)", fontSize: 10, fontWeight: 500,
  color: "var(--text-muted)", textTransform: "uppercase",
  letterSpacing: 0.5, marginBottom: 4,
};

const detailValue: React.CSSProperties = {
  fontFamily: "var(--font)", fontSize: 13, color: "var(--text-secondary)",
};

const tagStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 4,
  backgroundColor: "var(--bg-card)", border: "1px solid var(--border)",
  fontFamily: "var(--font)", fontSize: 11, color: "var(--text-secondary)",
};

function btnSmall(bg: string): React.CSSProperties {
  return {
    padding: "10px 16px", border: "none", borderRadius: 8,
    backgroundColor: bg, color: "#0a0a0f",
    cursor: "pointer", display: "flex", alignItems: "center",
  };
}

function btnPrimary(bg: string): React.CSSProperties {
  return {
    padding: "10px 24px", border: "none", borderRadius: 8,
    backgroundColor: bg, color: "#0a0a0f",
    fontFamily: "var(--font)", fontSize: 13, fontWeight: 600,
    display: "flex", alignItems: "center", gap: 8,
    alignSelf: "flex-start",
    transition: "background-color 0.2s",
  };
}

function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.8;
}
