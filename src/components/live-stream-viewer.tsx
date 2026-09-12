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
import { MonitorPlay, Radio, Square } from "lucide-react";

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
  const cleanupSentRef = useRef(false);

  const [viewerState, setViewerState] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [message, setMessage] = useState("Waiting for live stream.");

  const canWatch = Boolean(streamId) && status === "live";
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

  function startHeartbeat(sessionId: string) {
    stopHeartbeat();
    heartbeatRef.current = window.setInterval(() => {
      if (cleanupSentRef.current) {
        return;
      }
      void request(`/api/viewer/${sessionId}/ping`, { method: "POST", body: "{}" }).catch(() => {
        setMessage("Viewer heartbeat failed.");
      });
    }, 5000);
  }

  async function stopViewer() {
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
    if (sessionId && !cleanupSentRef.current) {
      cleanupSentRef.current = true;
      await request(`/api/viewer/${sessionId}`, { method: "DELETE" }).catch(() => undefined);
    }

    setViewerState("idle");
  }

  async function startViewer() {
    if (!streamLabel) {
      return;
    }

    await stopViewer();
    cleanupSentRef.current = false;
    setViewerState("connecting");
    setMessage("Connecting to media server.");

    const session = await request<ViewerSession>(
      `/api/streams/${encodeURIComponent(streamLabel)}/viewer/session`,
      { method: "POST", body: "{}" },
    );
    sessionIdRef.current = session.sessionId;
    startHeartbeat(session.sessionId);

    const device = new Device();
    await device.load({ routerRtpCapabilities: session.routerRtpCapabilities });

    const transportOptions = await request<TransportOptions>(
      `/api/viewer/${session.sessionId}/transport`,
      { method: "POST", body: "{}" },
    );

    const recvTransport = device.createRecvTransport(transportOptions);
    transportRef.current = recvTransport;

    recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
      request(
        `/api/viewer/${session.sessionId}/transport/${recvTransport.id}/connect`,
        { method: "POST", body: JSON.stringify({ dtlsParameters }) },
      ).then(callback).catch(errback);
    });

    recvTransport.on("connectionstatechange", (state) => {
      if (state === "failed" || state === "closed") {
        setViewerState("error");
        setMessage("Viewer transport disconnected.");
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

    const consumer = await recvTransport.consume(consumerOptions);
    consumerRef.current = consumer;

    if (videoRef.current) {
      videoRef.current.srcObject = new MediaStream([consumer.track]);
      await videoRef.current.play().catch(() => undefined);
    }

    await request(`/api/viewer/${session.sessionId}/consumer/${consumer.id}/resume`, {
      method: "POST",
      body: "{}",
    });

    setViewerState("live");
    setMessage("Live WebRTC stream connected.");
  }

  useEffect(() => {
    if (!canWatch) {
      void stopViewer();
      setMessage(status === "live" ? "Missing media stream id." : "Waiting for stream to become live.");
      return;
    }

    void startViewer().catch((error) => {
      setViewerState("error");
      setMessage(error instanceof Error ? error.message : "Viewer failed.");
    });

    return () => {
      void stopViewer();
    };
  }, [canWatch, streamLabel, status]);

  useEffect(() => {
    return () => {
      void stopViewer();
    };
  }, []);

  return (
    <div className="live-viewer">
      <video ref={videoRef} className="video-player" controls autoPlay muted playsInline />
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
