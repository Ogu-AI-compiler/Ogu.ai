import { useEffect, useState } from "react";
import { styled, Text, YStack } from "tamagui";
import { api } from "@/lib/api";

const Container = styled(YStack, {
  backgroundColor: "rgba(22,22,22,0.6)",
  borderRadius: "$4",
  padding: "$5",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.06)",
  gap: "$3",
});

export function RecentActivity() {
  const [logs, setLogs] = useState<{ name: string; content: string }[]>([]);

  useEffect(() => {
    api.getLogs().then(setLogs);
  }, []);

  const lines = logs
    .flatMap((log) =>
      log.content
        .split("\n")
        .filter((l) => l.startsWith("- "))
        .slice(0, 5)
        .map((l) => ({ date: log.name, text: l.replace(/^- /, "") }))
    )
    .slice(0, 8);

  return (
    <Container>
      <Text fontSize="$2" color="#b3b3b3" fontWeight="500" textTransform="uppercase" letterSpacing={0.5}>
        Recent Activity
      </Text>
      {lines.length === 0 ? (
        <Text fontSize="$2" color="#7a7a7a">No recent activity</Text>
      ) : (
        lines.map((l, i) => (
          <Text key={i} fontSize="$2" color="$color" numberOfLines={1}>
            <Text color="#7a7a7a">{l.date}</Text>  {l.text}
          </Text>
        ))
      )}
    </Container>
  );
}
