"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeSyncChanges, type SyncChangeEvent } from "@/services/sync-events-api";

export function useSyncRefresh(onRefresh: (event?: SyncChangeEvent) => void) {
  const refreshRef = useRef(onRefresh);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const abortController = new AbortController();
    let retryTimer: number | undefined;

    const connect = async () => {
      try {
        await subscribeSyncChanges({
          signal: abortController.signal,
          onChange: (event) => {
            setIsConnected(true);
            refreshRef.current(event);
          },
          onError: () => setIsConnected(false),
        });
      } catch {
        setIsConnected(false);
        if (!abortController.signal.aborted) {
          retryTimer = window.setTimeout(connect, 2000);
        }
      }
    };

    void connect();
    return () => {
      abortController.abort();
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, []);

  return { isConnected };
}
