import { useStore } from "@/lib/store";

export function useTheme() {
  const selectedTheme = useStore((s) => s.selectedTheme);
  const setSelectedTheme = useStore((s) => s.setSelectedTheme);
  return { selectedTheme, setSelectedTheme };
}
