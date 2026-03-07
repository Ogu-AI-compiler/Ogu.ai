const phaseStyles: Record<string, { bg: string; color: string }> = {
  idea: { bg: "rgba(245,158,11,0.15)", color: "#c89b3c" },
  feature: { bg: "rgba(59,130,246,0.15)", color: "#b3b3b3" },
  architect: { bg: "rgba(212,212,212,0.12)", color: "#d4d4d4" },
  ready: { bg: "rgba(34,197,94,0.15)", color: "#3fa36b" },
  done: { bg: "rgba(148,148,168,0.15)", color: "#b3b3b3" },
};

interface Props {
  slug: string;
  phase: string;
  tasks: number;
  isActive: boolean;
  onPress: () => void;
}

export function FeatureCard({ slug, phase, tasks, isActive, onPress }: Props) {
  const style = phaseStyles[phase] || phaseStyles.idea;

  return (
    <div
      onClick={onPress}
      style={{
        backgroundColor: "rgba(22,22,22,0.6)",
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: isActive ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.06)",
        gap: 12,
        cursor: "pointer",
        minWidth: 220,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 600 }}>{slug}</span>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 2,
            paddingBottom: 2,
            borderRadius: 99,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            backgroundColor: style.bg,
            color: style.color,
          }}
        >
          {phase}
        </span>
        {tasks > 0 && (
          <span style={{ fontSize: 11, color: "#7a7a7a" }}>{tasks} tasks</span>
        )}
      </div>
      {isActive && (
        <span style={{ fontSize: 11, fontWeight: 600, color: "#d4d4d4" }}>ACTIVE</span>
      )}
    </div>
  );
}
