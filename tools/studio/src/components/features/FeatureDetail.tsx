import { useEffect, useState } from "react";
import { styled, YStack, XStack, Text, ScrollView } from "tamagui";
import { api } from "@/lib/api";
import { Icon, icons } from "@/lib/icons";

const Tab = styled(Text, {
  fontSize: "$3",
  fontWeight: "500",
  paddingHorizontal: "$4",
  paddingVertical: "$2",
  borderRadius: "$2",
  cursor: "pointer",
  variants: {
    active: {
      true: { backgroundColor: "rgba(212,212,212,0.12)", color: "#d4d4d4" },
      false: { color: "#b3b3b3", hoverStyle: { color: "$color", backgroundColor: "rgba(255,255,255,0.04)" } },
    },
  } as const,
});

const tabs = ["PRD", "Spec", "Plan", "QA", "Metrics"];

interface Props {
  slug: string;
  onBack: () => void;
}

export function FeatureDetail({ slug, onBack }: Props) {
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("PRD");

  useEffect(() => {
    api.getFeature(slug).then(setData);
  }, [slug]);

  if (!data) return <Text color="#b3b3b3">Loading...</Text>;

  const content: Record<string, string> = {
    PRD: data.prd || "No PRD yet",
    Spec: data.spec || "No Spec yet",
    Plan: data.plan ? JSON.stringify(data.plan, null, 2) : "No Plan yet",
    QA: data.qa || "No QA yet",
    Metrics: data.metrics ? JSON.stringify(data.metrics, null, 2) : "No Metrics yet",
  };

  const phaseColor: Record<string, string> = {
    idea: "#c89b3c", feature: "#b3b3b3", architect: "#d4d4d4", ready: "#3fa36b", done: "#b3b3b3",
  };

  return (
    <YStack gap="$5" flex={1}>
      <XStack alignItems="center" gap="$3">
        <Text
          fontSize="$3"
          color="#b3b3b3"
          cursor="pointer"
          hoverStyle={{ color: "$color" }}
          onPress={onBack}
        >
          <Icon d={icons.arrowLeft} size={16} /> Back
        </Text>
        <Text fontSize="$7" fontWeight="700" color="$color" letterSpacing={-0.5}>{slug}</Text>
        <Text fontSize="$2" fontWeight="600" color={phaseColor[data.phase] || "#b3b3b3"}>
          {data.phase}
        </Text>
      </XStack>

      <XStack gap="$1" borderBottomWidth={1} borderBottomColor="rgba(255,255,255,0.06)" paddingBottom="$2">
        {tabs.map((t) => (
          <Tab key={t} active={activeTab === t} onPress={() => setActiveTab(t)}>{t}</Tab>
        ))}
      </XStack>

      <ScrollView flex={1}>
        <YStack
          backgroundColor="rgba(15,15,23,0.8)"
          borderRadius="$3"
          padding="$5"
          borderWidth={1}
          borderColor="rgba(255,255,255,0.06)"
        >
          <Text fontSize="$2" fontFamily="$body" color="$color" whiteSpace="pre-wrap">
            {content[activeTab]}
          </Text>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
