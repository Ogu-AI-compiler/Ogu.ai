import { useStore } from "@/lib/store";
import { presets } from "@/theme/presets";
import { PresetCard } from "./PresetCard";
import { ThemePreview } from "./ThemePreview";

export function ThemeView() {
  const { selectedTheme, setSelectedTheme } = useStore();
  const previewTokens = presets[selectedTheme]?.tokens || presets.dark.tokens;

  return (
    <div style={{ flex: 1, padding: 28, gap: 24, overflow: "scroll", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: "var(--text)" }}>Theme</span>
        <span style={{ fontSize: 16, color: "var(--text-secondary)" }}>
          Click a preset — the entire Studio changes instantly
        </span>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {Object.entries(presets).map(([name, preset]) => (
          <PresetCard
            key={name}
            name={name}
            label={preset.label}
            description={preset.description}
            tokens={preset.tokens}
            isActive={selectedTheme === name}
            onPress={() => setSelectedTheme(name)}
          />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-secondary)" }}>
          Active: {selectedTheme}
        </span>
        <ThemePreview tokens={previewTokens} />
      </div>
    </div>
  );
}
