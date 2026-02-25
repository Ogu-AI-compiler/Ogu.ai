import { styled, YStack, XStack, Text } from "tamagui";
import type { OguThemeTokens } from "@/theme/tokens";

const Card = styled(YStack, {
  backgroundColor: "rgba(22,22,22,0.6)",
  borderRadius: "$4",
  padding: "$5",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.06)",
  gap: "$3",
  width: 200,
  cursor: "pointer",
  hoverStyle: {
    borderColor: "rgba(139,92,246,0.2)",
    backgroundColor: "rgba(28,28,28,0.7)",
  },
  pressStyle: { scale: 0.98 },
  variants: {
    isActive: {
      true: { borderColor: "rgba(139,92,246,0.4)" },
    },
  } as const,
});

const Swatch = styled(YStack, {
  width: 24,
  height: 24,
  borderRadius: "$2",
});

interface Props {
  name: string;
  label: string;
  description: string;
  tokens: OguThemeTokens;
  isActive: boolean;
  onPress: () => void;
}

export function PresetCard({ label, description, tokens, isActive, onPress }: Props) {
  return (
    <Card isActive={isActive} onPress={onPress}>
      <Text fontSize="$4" fontWeight="600" color="$color">{label}</Text>
      <Text fontSize="$2" color="#b3b3b3" numberOfLines={1}>{description}</Text>
      <XStack gap={6}>
        <Swatch backgroundColor={tokens.colors.primary} />
        <Swatch backgroundColor={tokens.colors.secondary} />
        <Swatch backgroundColor={tokens.colors.background} />
        <Swatch backgroundColor={tokens.colors.surface} />
        <Swatch backgroundColor={tokens.colors.error} />
      </XStack>
      {isActive && (
        <Text fontSize="$1" fontWeight="600" color="#d4d4d4">ACTIVE</Text>
      )}
    </Card>
  );
}
