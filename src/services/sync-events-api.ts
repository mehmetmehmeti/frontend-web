import { getAuthToken } from "@/lib/auth-token";
import { getApiBaseUrl } from "@/services/api-client";

export type SyncChangeEvent = {
  source?: string;
  entity_type?: "user" | "device" | "stream" | "video" | "command";
  entity_id?: string;
  action?: string;
  event_id?: string;
};

type SyncHandlers = {
  signal: AbortSignal;
  onChange: (event: SyncChangeEvent) => void;
  onError: (error: Error) => void;
};

export async function subscribeSyncChanges({ signal, onChange, onError }: SyncHandlers) {
  const token = getAuthToken();
  const headers = new Headers({ Accept: "text/event-stream" });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}/sync/events/stream`, {
    headers,
    signal,
  });

  if (!response.body || !response.ok) {
    throw new Error(`Sync stream failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const boundary = buffer.lastIndexOf("\n\n");
    if (boundary < 0) continue;

    const chunk = buffer.slice(0, boundary);
    buffer = buffer.slice(boundary + 2);
    for (const block of chunk.split("\n\n")) {
      const eventLine = block.split("\n").find((line) => line.startsWith("event:"));
      const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
      if (!eventLine?.includes("sync-change") || !dataLine) continue;
      try {
        onChange(JSON.parse(dataLine.slice("data:".length).trim()) as SyncChangeEvent);
      } catch (error) {
        onError(error instanceof Error ? error : new Error("Could not parse sync event"));
      }
    }
  }
}
