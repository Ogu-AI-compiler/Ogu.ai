import { YStack } from "tamagui";
import { useStore } from "@/lib/store";
import { Chat } from "@/pages/Chat";
import { Dashboard } from "@/pages/Dashboard";
import { Features } from "@/pages/Features";
import { Brand } from "@/pages/Brand";

function OtherPage({ route }: { route: string }) {
  switch (route) {
    case "/dashboard": return <Dashboard />;
    case "/features":  return <Features />;
    case "/brand":     return <Brand />;
    default:           return null;
  }
}

export function MainArea() {
  const currentRoute = useStore((s) => s.currentRoute);
  const isChat = currentRoute === "/" || !(["/dashboard", "/features", "/brand"].includes(currentRoute));

  return (
    <YStack flex={1} overflow="hidden">
      {/* Chat stays mounted always — hidden when not active */}
      <div style={{ display: isChat ? "contents" : "none" }}>
        <Chat />
      </div>
      {!isChat && <OtherPage route={currentRoute} />}
    </YStack>
  );
}
