import { YStack, XStack, Text, styled } from "tamagui";
import { ColorSwatch } from "./ColorSwatch";

const Card = styled(YStack, {
  padding: "$4",
  borderRadius: "$3",
  backgroundColor: "$background",
  borderWidth: 1,
  borderColor: "$borderColor",
  gap: "$3",
  width: 280,
  hoverStyle: { borderColor: "$color" },
});

interface Props {
  domain: string;
  primary: string | null;
  secondary: string | null;
  background: string | null;
  fontBody: string | null;
  isDarkMode: boolean;
  scannedAt: string;
}

export function BrandCard({ domain, primary, secondary, background, fontBody, isDarkMode, scannedAt }: Props) {
  const date = scannedAt?.split("T")[0] || "?";

  return (
    <Card>
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$3" fontWeight="600" style={{ color: "var(--text)" }}>
          {domain}
        </Text>
        <Text fontSize={10} fontFamily="$body" style={{ color: "var(--text-secondary)" }}>
          {isDarkMode ? "dark" : "light"}
        </Text>
      </XStack>

      <YStack gap="$1">
        <ColorSwatch hex={primary} label="primary" />
        <ColorSwatch hex={secondary} label="secondary" />
        <ColorSwatch hex={background} label="bg" />
      </YStack>

      {fontBody && (
        <Text fontSize="$1" style={{ color: "var(--text-secondary)" }}>
          Font: {fontBody}
        </Text>
      )}

      <Text fontSize={10} fontFamily="$body" style={{ color: "var(--text-secondary)" }}>
        Scanned {date}
      </Text>
    </Card>
  );
}
