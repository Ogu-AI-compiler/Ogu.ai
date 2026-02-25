import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tamaguiPlugin } from "@tamagui/vite-plugin";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),
    tamaguiPlugin({
      config: "./src/theme/config.ts",
      components: ["tamagui"],
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4200",
      "/ws": {
        target: "ws://127.0.0.1:4200",
        ws: true,
      },
    },
  },
});
