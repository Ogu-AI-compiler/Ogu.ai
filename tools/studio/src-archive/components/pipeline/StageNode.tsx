interface Props {
  label: string;
  icon: string;
  status: "active" | "completed" | "pending";
  onPress?: () => void;
}

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  active: { borderColor: "#d4d4d4", backgroundColor: "rgba(212,212,212,0.10)" },
  completed: { borderColor: "#7a7a7a", backgroundColor: "rgba(255,255,255,0.04)" },
  pending: { borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.04)" },
};

export function StageNode({ label, icon, status, onPress }: Props) {
  return (
    <div
      onClick={onPress}
      style={{
        width: 100,
        height: 80,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        cursor: "pointer",
        borderWidth: 1,
        borderStyle: "solid",
        ...STATUS_STYLES[status],
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span
        style={{
          fontSize: 11,
          color: status === "active" ? "#d4d4d4" : "rgba(255,255,255,0.5)",
          textAlign: "center",
        }}
      >
        {label}
      </span>
    </div>
  );
}
