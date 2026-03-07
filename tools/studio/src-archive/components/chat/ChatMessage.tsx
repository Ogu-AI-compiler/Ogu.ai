export interface Message {
  id: string;
  role: "user" | "system";
  text: string;
}

const BUBBLE_STYLES: Record<string, React.CSSProperties> = {
  user: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(212,212,212,0.10)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(212,212,212,0.16)",
  },
  system: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.08)",
  },
};

export function ChatMessage({ role, text }: { role: "user" | "system"; text: string }) {
  return (
    <div
      style={{
        borderRadius: 8,
        padding: 8,
        maxWidth: "90%",
        display: "flex",
        flexDirection: "column",
        ...BUBBLE_STYLES[role],
      }}
    >
      <span style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>{text}</span>
    </div>
  );
}
