"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Device } from "mediasoup-client";
import type {
  Consumer,
  ConsumerOptions,
  RtpCapabilities,
  Transport,
  TransportOptions,
} from "mediasoup-client/types";
import { MonitorPlay, PlugZap, Radio, RefreshCw, Square } from "lucide-react";

const DEFAULT_MEDIA_SERVER_URL = "http://localhost:3010";
const DEFAULT_VIEWER_TOKEN = "local-viewer-token";

type ViewerSession = {
  sessionId: string;
  routerRtpCapabilities: RtpCapabilities;
};

type LiveStreamViewerProps = {
  streamId?: string | null;
  status?: string | null;
};

type MediaHealth = {
  ok: boolean;
  streams: Array<{ streamId: string; viewers: number }>;
  whipSessions: number;
  viewers: number;
};

function mediaServerBaseUrl() {
  return (process.env.NEXT_PUBLIC_MEDIA_SERVER_URL || DEFAULT_MEDIA_SERVER_URL).replace(/\/+$/, "");
}

function viewerToken() {
  return process.env.NEXT_PUBLIC_MEDIA_VIEWER_TOKEN || DEFAULT_VIEWER_TOKEN;
}

export function LiveStreamViewer({ streamId, status }: LiveStreamViewerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const transportRef = useRef<Transport | undefined>(undefined);
  const consumerRef = useRef<Consumer | undefined>(undefined);
  const heartbeatRef = useRef<number | undefined>(undefined);
  const reconnectRef = useRef<number | undefined>(undefined);
  const viewerRunRef = useRef(0);
  const cleanupSentRef = useRef(false);

  const [viewerState, setViewerState] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [message, setMessage] = useState("Waiting for live stream.");
  const [health, setHealth] = useState<MediaHealth | null>(null);

  const canWatch = Boolean(streamId) && String(status || "").toLowerCase() === "live";
  const streamLabel = useMemo(() => streamId ?? "", [streamId]);

  async function request<T>(path: string, init: RequestInit = {}) {
    const response = await fetch(`${mediaServerBaseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${viewerToken()}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `${response.status} ${response.statusText}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  function stopHeartbeat() {
    if (heartbeatRef.current === undefined) {
      return;
    }
    window.clearInterval(heartbeatRef.current);
    heartbeatRef.current = undefined;
  }

  function stopReconnectTimer() {
    if (reconnectRef.current === undefined) {
      return;
    }
    window.clearTimeout(reconnectRef.current);
    reconnectRef.current = undefined;
  }

  function isActiveRun(runId: number) {
    return viewerRunRef.current === runId;
  }

  function scheduleReconnect(runId: number, reason: string) {
    if (!isActiveRun(runId) || reconnectRef.current !== undefined) {
      return;
    }

    setViewerState("error");
    setMessage(reason);
    reconnectRef.current = window.setTimeout(() => {
      reconnectRef.current = undefined;
      if (isActiveRun(runId) && canWatch) {
        startViewer();
      }
    }, 1500);
  }

  function startHeartbeat(runId: number, sessionId: string) {
    stopHeartbeat();
    heartbeatRef.current = window.setInterval(() => {
      if (cleanupSentRef.current || !isActiveRun(runId)) {
        return;
      }
      void request(`/api/viewer/${sessionId}/ping`, { method: "POST", body: "{}" }).catch(() => {
        scheduleReconnect(runId, "Viewer heartbeat failed. Reconnecting.");
      });
    }, 5000);
  }

  async function cleanupViewer(notifyServer = true) {
    stopHeartbeat();
    consumerRef.current?.close();
    transportRef.current?.close();
    consumerRef.current = undefined;
    transportRef.current = undefined;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    const sessionId = sessionIdRef.current;
    sessionIdRef.current = undefined;
    if (sessionId && notifyServer && !cleanupSentRef.current) {
      cleanupSentRef.current = true;
      await request(`/api/viewer/${sessionId}`, { method: "DELETE" }).catch(() => undefined);
    }
  }

  async function stopViewer(runId?: number) {
    if (runId !== undefined && !isActiveRun(runId)) {
      return;
    }

    viewerRunRef.current += 1;
    stopReconnectTimer();
    await cleanupViewer();

    setViewerState("idle");
    setMessage("Viewer stopped.");
  }

  async function refreshHealth() {
    const payload = await request<MediaHealth>("/api/health");
    setHealth(payload);
    return payload;
  }

  async function createViewerSession(preferredStreamId: string) {
    try {
      return await request<ViewerSession>(
        `/api/streams/${encodeURIComponent(preferredStreamId)}/viewer/session`,
        { method: "POST", body: "{}" },
      );
    } catch (error) {
      const payload = await refreshHealth().catch(() => null);
      const fallbackStream = payload?.streams.length === 1 ? payload.streams[0]?.streamId : null;

      if (fallbackStream && fallbackStream !== preferredStreamId) {
        setMessage(`Using active media stream ${fallbackStream}.`);
        return request<ViewerSession>(
          `/api/streams/${encodeURIComponent(fallbackStream)}/viewer/session`,
          { method: "POST", body: "{}" },
        );
      }

      throw error;
    }
  }

  function startViewer() {
    if (!streamLabel) {
      return 0;
    }

    const runId = viewerRunRef.current + 1;
    viewerRunRef.current = runId;
    stopReconnectTimer();
    void connectViewer(runId).catch((error) => {
      if (!isActiveRun(runId)) {
        return;
      }
      setViewerState("error");
      setMessage(error instanceof Error ? error.message : "Viewer failed.");
      scheduleReconnect(runId, "Viewer failed. Reconnecting.");
    });
    return runId;
  }

  async function connectViewer(runId: number) {
    await cleanupViewer();
    if (!isActiveRun(runId)) {
      return;
    }

    cleanupSentRef.current = false;
    setViewerState("connecting");
    setMessage("Connecting to media server.");

    const session = await createViewerSession(streamLabel);

    if (!isActiveRun(runId)) {
      await request(`/api/viewer/${session.sessionId}`, { method: "DELETE" }).catch(() => undefined);
      return;
    }

    sessionIdRef.current = session.sessionId;
    startHeartbeat(runId, session.sessionId);

    const device = new Device();
    await device.load({ routerRtpCapabilities: session.routerRtpCapabilities });

    const transportOptions = await request<TransportOptions>(
      `/api/viewer/${session.sessionId}/transport`,
      { method: "POST", body: "{}" },
    );

    if (!isActiveRun(runId)) {
      return;
    }

    const recvTransport = device.createRecvTransport(transportOptions);
    transportRef.current = recvTransport;

    recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
      request(
        `/api/viewer/${session.sessionId}/transport/${recvTransport.id}/connect`,
        { method: "POST", body: JSON.stringify({ dtlsParameters }) },
      ).then(callback).catch(errback);
    });

    recvTransport.on("connectionstatechange", (state) => {
      if (!isActiveRun(runId)) {
        return;
      }
      if (state === "failed" || state === "closed") {
        scheduleReconnect(runId, "Viewer transport disconnected. Reconnecting.");
      }
    });

    const consumerOptions = await request<ConsumerOptions>(
      `/api/viewer/${session.sessionId}/consume`,
      {
        method: "POST",
        body: JSON.stringify({
          transportId: recvTransport.id,
          rtpCapabilities: device.rtpCapabilities,
        }),
      },
    );

    if (!isActiveRun(runId)) {
      return;
    }

    const consumer = await recvTransport.consume(consumerOptions);
    consumerRef.current = consumer;

    await request(`/api/viewer/${session.sessionId}/consumer/${consumer.id}/resume`, {
      method: "POST",
      body: "{}",
    });

    if (videoRef.current) {
      videoRef.current.srcObject = new MediaStream([consumer.track]);
      await videoRef.current.play().catch(() => undefined);
    }

    if (!isActiveRun(runId)) {
      return;
    }

    setViewerState("live");
    setMessage("Live WebRTC stream connected.");
    void refreshHealth().catch(() => undefined);
  }

  useEffect(() => {
    if (!canWatch) {
      void stopViewer();
      setMessage(status === "live" ? "Missing media stream id." : "Waiting for stream to become live.");
      return;
    }

    const runId = startViewer();

    return () => {
      void stopViewer(runId);
    };
  }, [canWatch, streamLabel, status]);

  useEffect(() => {
    void refreshHealth().catch(() => undefined);
    const timer = window.setInterval(() => {
      void refreshHealth().catch(() => setHealth(null));
    }, 4000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="live-viewer">
      <video ref={videoRef} className="video-player" controls autoPlay muted playsInline />
      <div className="viewer-toolbar">
        <span className={health?.ok ? "media-health online" : "media-health"}>
          <PlugZap size={14} />
          {health?.ok ? `${health.streams.length} media stream${health.streams.length === 1 ? "" : "s"}` : "media server"}
        </span>
        <button
          className="viewer-tool-button"
          type="button"
          disabled={!canWatch || viewerState === "connecting"}
          onClick={() => {
            startViewer();
          }}
          title="Reconnect viewer"
        >
          <RefreshCw size={14} />
        </button>
        <button
          className="viewer-tool-button"
          type="button"
          disabled={viewerState === "idle"}
          onClick={() => void stopViewer()}
          title="Stop viewer"
        >
          <Square size={14} />
        </button>
      </div>
      {viewerState !== "live" && (
        <div className="empty-viewer live-overlay">
          <MonitorPlay size={42} />
          <p>{message}</p>
        </div>
      )}
      <div className={`viewer-status ${viewerState}`}>
        {viewerState === "live" ? <Radio size={14} /> : <Square size={14} />}
        {viewerState}
      </div>
    </div>
  );
}
