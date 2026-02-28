import { useState } from "react";
import { styled, Text, YStack, XStack, ScrollView } from "tamagui";

const Overlay = styled(YStack, {
  position: "absolute" as any,
  top: 0,
  right: 0,
  bottom: 0,
  width: 420,
  backgroundColor: "rgba(14,14,14,0.98)",
  borderLeftWidth: 1,
  borderColor: "rgba(255,255,255,0.1)",
  zIndex: 100,
  padding: "$5",
  gap: "$4",
});

const CloseBtn = styled(XStack, {
  width: 28,
  height: 28,
  borderRadius: 14,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,0.06)",
  cursor: "pointer",
  hoverStyle: { backgroundColor: "rgba(255,255,255,0.12)" },
});

interface DetailPanelProps {
  title: string;
  data: Record<string, any> | null;
  onClose: () => void;
  children?: React.ReactNode;
}

export function DetailPanel({ title, data, onClose, children }: DetailPanelProps) {
  if (!data) return null;

  return (
    <Overlay>
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$4" fontWeight="700">{title}</Text>
        <CloseBtn onPress={onClose}>
          <Text fontSize="$3" color="$colorPress">×</Text>
        </CloseBtn>
      </XStack>

      {children}

      <ScrollView flex={1}>
        <YStack gap="$2">
          {Object.entries(data).map(([key, value]) => (
            <YStack key={key} gap="$1">
              <Text fontSize={10} color="#6c5ce7" fontFamily="$mono" textTransform="uppercase">
                {key}
              </Text>
              <Text
                fontSize="$1"
                color="$colorPress"
                fontFamily="$mono"
                style={{ wordBreak: "break-all" as any }}
              >
                {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "—")}
              </Text>
            </YStack>
          ))}
        </YStack>
      </ScrollView>
    </Overlay>
  );
}
