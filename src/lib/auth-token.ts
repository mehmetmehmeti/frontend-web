import { useAuthStore } from "@/store/auth.store";

export function getAuthToken() {
  return useAuthStore.getState().token;
}
