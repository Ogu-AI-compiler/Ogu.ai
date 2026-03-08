import { useToastStore } from "@/lib/toast-store";

export function useToast() {
  const addToast = useToastStore((s) => s.addToast);
  const dismissToast = useToastStore((s) => s.dismissToast);

  return {
    toast: addToast,
    dismissToast,
  };
}
