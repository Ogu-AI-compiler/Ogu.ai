interface Props {
  done?: boolean;
}

export function StageConnector({ done = false }: Props) {
  return (
    <div
      style={{
        width: 32,
        height: 2,
        alignSelf: "center",
        backgroundColor: done ? "#d4d4d4" : "rgba(255,255,255,0.08)",
        borderRadius: 1,
        flexShrink: 0,
      }}
    />
  );
}
