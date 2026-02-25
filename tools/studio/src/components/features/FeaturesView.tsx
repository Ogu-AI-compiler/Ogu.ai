import { useState } from "react";
import { styled, YStack, XStack, Text } from "tamagui";
import { useFeatures } from "@/hooks/useFeatures";
import { Icon, icons } from "@/lib/icons";
import { FeatureCard } from "./FeatureCard";
import { FeatureDetail } from "./FeatureDetail";
import { CreateDialog } from "./CreateDialog";

const Page = styled(YStack, {
  flex: 1,
  padding: "$7",
  gap: "$6",
});

const CreateBtn = styled(YStack, {
  backgroundColor: "#d4d4d4",
  borderRadius: "$3",
  paddingHorizontal: "$5",
  paddingVertical: "$3",
  cursor: "pointer",
  hoverStyle: { backgroundColor: "#e4e4e4" },
  pressStyle: { scale: 0.98 },
});

export function FeaturesView() {
  const { features, activeFeature, create } = useFeatures();
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  if (selected) {
    return (
      <Page>
        <FeatureDetail slug={selected} onBack={() => setSelected(null)} />
      </Page>
    );
  }

  return (
    <Page>
      <XStack justifyContent="space-between" alignItems="flex-end">
        <YStack gap="$2">
          <Text fontSize="$7" fontWeight="700" color="$color" letterSpacing={-0.5}>Features</Text>
          <Text fontSize="$4" color="#b3b3b3">{features.length} features</Text>
        </YStack>
        <CreateBtn onPress={() => setShowCreate(true)}>
          <Text fontSize="$3" fontWeight="600" color="white">+ New Feature</Text>
        </CreateBtn>
      </XStack>

      <XStack gap="$4" flexWrap="wrap">
        {features.map((f) => (
          <FeatureCard
            key={f.slug}
            slug={f.slug}
            phase={f.phase}
            tasks={f.tasks}
            isActive={f.slug === activeFeature}
            onPress={() => setSelected(f.slug)}
          />
        ))}
      </XStack>

      {features.length === 0 && (
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" paddingVertical="$10">
          <Icon d={icons.clipboard} size={32} stroke="var(--text-muted)" />
          <Text fontSize="$5" fontWeight="600" color="$color">No features yet</Text>
          <Text fontSize="$3" color="#b3b3b3">Create your first feature to get started</Text>
        </YStack>
      )}

      <CreateDialog open={showCreate} onClose={() => setShowCreate(false)} onCreate={create} />
    </Page>
  );
}
