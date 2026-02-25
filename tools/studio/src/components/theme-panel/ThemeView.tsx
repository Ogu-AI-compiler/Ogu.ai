import { YStack, XStack, Text } from "tamagui";
import { useStore } from "@/lib/store";
import { presets } from "@/theme/presets";
import { PresetCard } from "./PresetCard";
import { ThemePreview } from "./ThemePreview";

export function ThemeView() {
  const { selectedTheme, setSelectedTheme } = useStore();
  const previewTokens = presets[selectedTheme]?.tokens || presets.dark.tokens;

  return (
    <YStack flex={1} padding="$7" gap="$6" overflow="scroll">
      <YStack gap="$2">
        <Text fontSize="$7" fontWeight="700" letterSpacing={-0.5}
          style={{ color: "var(--text)" }}>Theme</Text>
        <Text fontSize="$4" style={{ color: "var(--text-secondary)" }}>
          Click a preset — the entire Studio changes instantly
        </Text>
      </YStack>

      <XStack gap="$4" flexWrap="wrap">
        {Object.entries(presets).map(([name, preset]) => (
          <PresetCard
            key={name}
            name={name}
            label={preset.label}
            description={preset.description}
            tokens={preset.tokens}
            isActive={selectedTheme === name}
            onPress={() => setSelectedTheme(name)}
          />
        ))}
      </XStack>

      <YStack gap="$3">
        <Text fontSize="$2" fontWeight="500" textTransform="uppercase" letterSpacing={0.5}
          style={{ color: "var(--text-secondary)" }}>
          Active: {selectedTheme}
        </Text>
        <ThemePreview tokens={previewTokens} />
      </YStack>
    </YStack>
  );
}
