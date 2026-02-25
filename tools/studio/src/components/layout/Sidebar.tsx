import { useEffect, useState } from "react";
import { styled, Text, YStack, XStack, Separator } from "tamagui";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";

const SidebarContainer = styled(YStack, {
  width: 260,
  height: "100%",
  backgroundColor: "$backgroundHover",
  borderRightWidth: 1,
  borderRightColor: "$borderColor",
  padding: "$3",
  gap: "$2",
});

const Logo = styled(Text, {
  fontFamily: "$heading",
  fontSize: "$5",
  color: "$color",
  paddingVertical: "$2",
});

const PlatformBadge = styled(XStack, {
  backgroundColor: "$background",
  paddingHorizontal: "$2",
  paddingVertical: "$1",
  borderRadius: "$1",
  alignSelf: "flex-start",
});

const NavItem = styled(XStack, {
  paddingHorizontal: "$2",
  paddingVertical: "$2",
  borderRadius: "$2",
  cursor: "pointer",
  hoverStyle: { backgroundColor: "$background" },
  variants: {
    active: {
      true: { backgroundColor: "$background" },
    },
  } as const,
});

const FeatureItem = styled(XStack, {
  paddingHorizontal: "$2",
  paddingVertical: "$1",
  borderRadius: "$1",
  gap: "$1",
  variants: {
    isActive: {
      true: { backgroundColor: "$background" },
    },
  } as const,
});

const phaseColors: Record<string, string> = {
  idea: "#ffb800",
  feature: "#00d4ff",
  architect: "#6c5ce7",
  ready: "#d4d4d4",
  done: "#7a7a7a",
};

const routes = [
  { path: "/", label: "Dashboard" },
  { path: "/pipeline", label: "Pipeline" },
  { path: "/features", label: "Features" },
  { path: "/theme", label: "Theme" },
  { path: "/brand", label: "Brand" },
  { path: "/terminal", label: "Terminal" },
];

export function Sidebar() {
  const {
    projectName,
    platform,
    features,
    activeFeature,
    currentRoute,
    setProjectData,
    setFeatures,
    setRoute,
  } = useStore();

  const [hasBrandScan, setHasBrandScan] = useState(false);

  const refresh = () => {
    api.getState().then((data) => {
      const name = data.root?.split("/").pop() || "Ogu Project";
      setProjectData({
        projectName: name,
        platform: data.profile?.platform || "web",
        themeData: data.theme,
      });
    });
    api.getFeatures().then((data) => {
      setFeatures(data.features, data.active);
    });
    api.getBrandScans().then((scans) => {
      setHasBrandScan(Array.isArray(scans) && scans.length > 0);
    }).catch(() => {});
  };

  // Initial load + periodic refresh (picks up brand scans done via CLI)
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SidebarContainer>
      <Logo>Ogu Studio</Logo>
      <PlatformBadge>
        <Text fontSize="$1" color="$colorPress" fontFamily="$body">
          {platform}
        </Text>
      </PlatformBadge>

      <Separator marginVertical="$2" borderColor="$borderColor" />

      <YStack gap="$1">
        {routes.map((r) => (
          <NavItem
            key={r.path}
            active={currentRoute === r.path}
            onPress={() => setRoute(r.path)}
          >
            <Text fontSize="$2" color={currentRoute === r.path ? "$color" : "$colorPress"} flex={1}>
              {r.label}
            </Text>
            {r.path === "/brand" && hasBrandScan && (
              <XStack
                alignItems="center"
                gap="$1"
                paddingHorizontal={6}
                paddingVertical={2}
                borderRadius={10}
                backgroundColor="rgba(0, 212, 255, 0.15)"
              >
                <Text fontSize={9} color="#00d4ff" fontFamily="$body" fontWeight="600">
                  SCANNED
                </Text>
              </XStack>
            )}
          </NavItem>
        ))}
      </YStack>

      <Separator marginVertical="$2" borderColor="$borderColor" />

      <Text fontSize="$1" color="$colorPress" fontFamily="$body" marginBottom="$1">
        FEATURES
      </Text>
      <YStack gap="$1" flex={1} overflow="hidden">
        {features.length === 0 ? (
          <Text fontSize="$1" color="$colorPress">
            No features yet
          </Text>
        ) : (
          features.slice(0, 12).map((f) => (
            <FeatureItem key={f.slug} isActive={f.slug === activeFeature}>
              <Text fontSize={10} color={phaseColors[f.phase] || "#666"}>
                ●
              </Text>
              <Text fontSize="$1" color="$color" numberOfLines={1}>
                {f.slug}
              </Text>
              <Text fontSize={10} color="$colorPress" marginLeft="auto">
                {f.phase}
              </Text>
            </FeatureItem>
          ))
        )}
      </YStack>

      <Separator marginVertical="$1" borderColor="$borderColor" />
      <Text fontSize={10} color="$colorPress" fontFamily="$body">
        {projectName}
      </Text>
    </SidebarContainer>
  );
}
