import { ColorSwatch } from "./ColorSwatch";

interface Props {
  domain: string;
  primary: string | null;
  secondary: string | null;
  background: string | null;
  fontBody: string | null;
  isDarkMode: boolean;
  scannedAt: string;
}

export function BrandCard({ domain, primary, secondary, background, fontBody, isDarkMode, scannedAt }: Props) {
  const date = scannedAt?.split("T")[0] || "?";

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        backgroundColor: "rgba(0,0,0,0.2)",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "rgba(255,255,255,0.08)",
        gap: 12,
        width: 280,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{domain}</span>
        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{isDarkMode ? "dark" : "light"}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <ColorSwatch hex={primary} label="primary" />
        <ColorSwatch hex={secondary} label="secondary" />
        <ColorSwatch hex={background} label="bg" />
      </div>

      {fontBody && (
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Font: {fontBody}</span>
      )}

      <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>Scanned {date}</span>
    </div>
  );
}
