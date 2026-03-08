interface FullscreenLayoutProps {
  children: React.ReactNode;
}

export function FullscreenLayout({ children }: FullscreenLayoutProps) {
  return (
    <div
      className="flex h-screen w-screen items-center justify-center"
      style={{ background: "#080808", position: "relative", overflow: "hidden" }}
    >
      {/* Animated mesh gradient */}
      <div className="mesh-bg" />
      {/* Noise texture */}
      <div className="noise-overlay" />
      {/* Content */}
      <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}
