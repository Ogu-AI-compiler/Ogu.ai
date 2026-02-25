import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TamaguiProvider, Theme } from "tamagui";
import config from "./theme/config";
import { useStore } from "./lib/store";
import { App } from "./App";

function Root() {
  return (
    <TamaguiProvider config={config}>
      <Theme name="dark">
        <App />
      </Theme>
    </TamaguiProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
