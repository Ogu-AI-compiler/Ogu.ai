import type { StateCreator } from "zustand";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  plan: string;
  org_id?: string;
}

export interface AuthSlice {
  currentUser: AuthUser | null;
  accessToken: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
}

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (set) => ({
  currentUser: null,
  accessToken: (() => {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem("ogu-access-token");
  })(),
  setAuth: (user, token) => {
    if (typeof localStorage !== "undefined") localStorage.setItem("ogu-access-token", token);
    set({ currentUser: user, accessToken: token });
  },
  clearAuth: () => {
    if (typeof localStorage !== "undefined") localStorage.removeItem("ogu-access-token");
    set({ currentUser: null, accessToken: null });
  },
});
