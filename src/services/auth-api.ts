import { apiFetch } from "@/services/api-client";
import type { User } from "@/types/domain";

type AuthResponse = {
  token: string;
  user: User;
};

export function login(email: string, password: string) {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email, password }),
  });
}

export function register(email: string, password: string, fullName: string) {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email, password, fullName, role: "ADMIN" }),
  });
}

export function me() {
  return apiFetch<{ user: User }>("/auth/me");
}
