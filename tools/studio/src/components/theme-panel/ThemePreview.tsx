import { styled, YStack, XStack, Text } from "tamagui";
import type { OguThemeTokens } from "@/theme/tokens";

const Preview = styled(YStack, {
  borderRadius: "$2",
  padding: "$3",
  borderWidth: 1,
  gap: "$2",
  overflow: "hidden",
});

interface Props {
  tokens: OguThemeTokens;
}

export function ThemePreview({ tokens }: Props) {
  const c = tokens.colors;
  const fx = tokens.effects;

  return (
    <Preview backgroundColor={c.background} borderColor={c.surface}>
      <Text fontFamily={tokens.typography.font_heading as any} fontSize={20} color={c.text}>
        Preview
      </Text>
      <Text fontFamily={tokens.typography.font_body as any} fontSize={14} color={c.text_muted}>
        Body text with muted secondary content
      </Text>
      <XStack gap={8}>
        <YStack
          backgroundColor={c.surface}
          borderRadius={parseInt(tokens.radius.md)}
          padding={12}
          borderWidth={1}
          borderColor={c.primary}
          style={{ boxShadow: fx.glow !== "none" ? fx.glow : undefined }}
        >
          <Text fontFamily={tokens.typography.font_mono as any} fontSize={12} color={c.primary}>
            Primary
          </Text>
        </YStack>
        <YStack
          backgroundColor={c.surface}
          borderRadius={parseInt(tokens.radius.md)}
          padding={12}
        >
          <Text fontFamily={tokens.typography.font_mono as any} fontSize={12} color={c.secondary}>
            Secondary
          </Text>
        </YStack>
        <YStack
          backgroundColor={c.error}
          borderRadius={parseInt(tokens.radius.md)}
          padding={12}
        >
          <Text fontFamily={tokens.typography.font_mono as any} fontSize={12} color={c.background}>
            Error
          </Text>
        </YStack>
      </XStack>
      <XStack gap={8} alignItems="center">
        <YStack width={60} height={8} borderRadius={4} backgroundColor={c.primary} />
        <YStack width={40} height={8} borderRadius={4} backgroundColor={c.secondary} />
        <YStack width={20} height={8} borderRadius={4} backgroundColor={c.text_muted} />
      </XStack>
    </Preview>
  );
}
