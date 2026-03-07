/**
 * Toast notification store — Zustand-based, matches existing pattern.
 */

import { create } from "zustand";

export type ToastSeverity = "info" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  message: string;
  severity: ToastSeverity;
  duration: number; // ms — 0 = sticky
  createdAt: number;
  dismissing?: boolean;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, opts?: { severity?: ToastSeverity; duration?: number }) => string;
  dismissToast: (id: string) => void;
  removeToast: (id: string) => void;
}

let counter = 0;
const uid = () => `toast-${++counter}-${Date.now()}`;

const MAX_VISIBLE = 3;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (message, opts) => {
    const id = uid();
    const severity = opts?.severity ?? "info";
    const duration = opts?.duration ?? 5000;
    const toast: Toast = { id, message, severity, duration, createdAt: Date.now() };

    set((state) => {
      let toasts = [...state.toasts, toast];
      // Auto-dismiss oldest when overflow
      while (toasts.filter((t) => !t.dismissing).length > MAX_VISIBLE) {
        const oldest = toasts.find((t) => !t.dismissing);
        if (oldest) {
          toasts = toasts.map((t) => t.id === oldest.id ? { ...t, dismissing: true } : t);
        } else break;
      }
      return { toasts };
    });

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => get().dismissToast(id), duration);
    }

    return id;
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, dismissing: true } : t
      ),
    }));
    // Remove after exit animation
    setTimeout(() => get().removeToast(id), 300);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
