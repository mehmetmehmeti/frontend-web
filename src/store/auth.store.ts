"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as authApi from "@/services/auth-api";
import type { User } from "@/types/domain";

type AuthState = {
  token: string | null;
  user: User | null;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  initialize: () => Promise<void>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isInitialized: false,
      login: async (email, password) => {
        const response = await authApi.login(email, password);
        set({ token: response.token, user: response.user, isInitialized: true });
      },
      register: async (email, password, fullName) => {
        const response = await authApi.register(email, password, fullName);
        set({ token: response.token, user: response.user, isInitialized: true });
      },
      initialize: async () => {
        if (!get().token) {
          set({ isInitialized: true });
          return;
        }
        try {
          const response = await authApi.me();
          set({ user: response.user, isInitialized: true });
        } catch {
          set({ token: null, user: null, isInitialized: true });
        }
      },
      logout: () => set({ token: null, user: null, isInitialized: true }),
    }),
    {
      name: "diploma-cloud-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
