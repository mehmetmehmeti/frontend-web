import { getAuthToken } from "@/lib/auth-token";

const DEFAULT_API_URL = "http://localhost:3000";
const REQUEST_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
}

async function parseError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message || payload.error || `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
}

export async function apiFetch<TResponse>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<TResponse> {
  const { auth = true, headers, ...requestInit } = init;
  const requestHeaders = new Headers(headers);
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  if (requestInit.body && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const token = auth ? getAuthToken() : null;
  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...requestInit,
      headers: requestHeaders,
      signal: timeoutController.signal,
    });

    if (!response.ok) {
      throw new ApiError(await parseError(response), response.status);
    }

    return (await response.json()) as TResponse;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Could not reach the backend API.", 0);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
