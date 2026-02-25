import { styled, Text, YStack } from "tamagui";

const Card = styled(YStack, {
  backgroundColor: "rgba(22,22,22,0.6)",
  borderRadius: "$4",
  padding: "$5",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
  gap: "$2",
  minWidth: 160,
  flex: 1,
});

interface Props {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

export function StatusCard({ label, value, sub, accent }: Props) {
  return (
    <Card>
      <Text fontSize="$2" color="#b3b3b3" fontWeight="500" textTransform="uppercase" letterSpacing={0.5}>
        {label}
      </Text>
      <Text fontSize="$6" fontWeight="700" color={accent ? "#d4d4d4" : "$color"} letterSpacing={-0.3}>
        {value}
      </Text>
      {sub && <Text fontSize="$2" color="#7a7a7a">{sub}</Text>}
    </Card>
  );
}
