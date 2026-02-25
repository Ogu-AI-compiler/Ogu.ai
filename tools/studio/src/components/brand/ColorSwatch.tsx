import { XStack, Text } from "tamagui";

interface Props {
  hex: string | null;
  label?: string;
}

export function ColorSwatch({ hex, label }: Props) {
  if (!hex) return null;

  return (
    <XStack gap="$2" alignItems="center">
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          backgroundColor: hex,
          border: "1px solid rgba(255,255,255,0.1)",
          flexShrink: 0,
        }}
      />
      <Text fontSize="$1" fontFamily="$body" style={{ color: "var(--text-secondary)" }}>
        {label ? `${label} ` : ""}{hex}
      </Text>
    </XStack>
  );
}
