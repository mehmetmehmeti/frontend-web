"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CircleDot,
  Cloud,
  LogOut,
  MonitorPlay,
  Radio,
  RefreshCw,
  Square,
  UserPlus,
  Video,
} from "lucide-react";
import { LiveStreamViewer } from "@/components/live-stream-viewer";
import { useSyncRefresh } from "@/hooks/use-sync-refresh";
import {
  listCommands,
  listDevices,
  listStreams,
  listUsers,
  listVideos,
  registerDevice,
  startRecording,
  startStream,
  stopRecording,
  stopStream,
} from "@/services/domain-api";
import { useAuthStore } from "@/store/auth.store";
import type { Command, Device, Stream, User, Video as VideoRecord } from "@/types/domain";

const DEFAULT_DEVICE_ID = process.env.NEXT_PUBLIC_DEFAULT_DEVICE_ID || "edge-dev-001";

type DashboardState = {
  users: User[];
  devices: Device[];
  streams: Stream[];
  videos: VideoRecord[];
  commands: Command[];
};

const emptyState: DashboardState = {
  users: [],
  devices: [],
  streams: [],
  videos: [],
  commands: [],
};

export default function Home() {
  const { token, user, isInitialized, initialize, logout } = useAuthStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!isInitialized) {
    return <main className="centered">Loading console...</main>;
  }

  if (!token || !user) {
    return <AuthPanel />;
  }

  return <Dashboard onLogout={logout} user={user} />;
}

function AuthPanel() {
  const { login, register } = useAuthStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      if (mode === "register") {
        await register(email, password, fullName);
      } else {
        await login(email, password);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-row">
          <Cloud size={28} />
          <div>
            <h1>Diploma Cloud Console</h1>
            <p>Control streaming and recording across synced edge devices.</p>
          </div>
        </div>

        <div className="segmented">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Login
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Register
          </button>
        </div>

        <form className="form" onSubmit={submit}>
          {mode === "register" && (
            <label>
              Full name
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {mode === "register" ? <UserPlus size={18} /> : <Cloud size={18} />}
            {isSubmitting ? "Working..." : mode === "register" ? "Create Account" : "Enter Console"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [state, setState] = useState<DashboardState>(emptyState);
  const [deviceId, setDeviceId] = useState(DEFAULT_DEVICE_ID);
  const [streamTitle, setStreamTitle] = useState("Diploma live stream");
  const [selectedStreamId, setSelectedStreamId] = useState<string>("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [lastSync, setLastSync] = useState<string>("No sync events yet");

  const refresh = useCallback(async () => {
    const [users, devices, streams, videos, commands] = await Promise.all([
      listUsers(),
      listDevices(),
      listStreams(),
      listVideos(),
      listCommands(),
    ]);
    setState({
      users: users.users,
      devices: devices.devices,
      streams: streams.streams,
      videos: videos.videos,
      commands: commands.commands,
    });
  }, []);

  const { isConnected } = useSyncRefresh((event) => {
    setLastSync(event ? `${event.entity_type || "data"} ${event.action || "changed"}` : "updated");
    void refresh();
  });

  useEffect(() => {
    void refresh().catch((caught) => setError(caught instanceof Error ? caught.message : "Load failed."));
  }, [refresh]);

  const selectedStream = useMemo(
    () => state.streams.find((stream) => stream.id === selectedStreamId),
    [selectedStreamId, state.streams],
  );
  const liveStream = useMemo(
    () => state.streams.find((stream) => stream.status === "live" && (stream.mediasoup_stream_id || stream.id)),
    [state.streams],
  );
  const activeStream = useMemo(
    () =>
      selectedStream?.status === "live"
        ? selectedStream
        : liveStream ||
          selectedStream ||
          state.streams.find((stream) => ["starting", "stopping"].includes(stream.status)) ||
          state.streams[0],
    [liveStream, selectedStream, state.streams],
  );

  useEffect(() => {
    if (liveStream && selectedStream?.status !== "live") {
      setSelectedStreamId(liveStream.id);
      return;
    }
    if (activeStream && !selectedStreamId) {
      setSelectedStreamId(activeStream.id);
    }
  }, [activeStream, liveStream, selectedStream, selectedStreamId]);

  const activeRecording = state.videos.find(
    (video) => video.stream_id === activeStream?.id && video.status === "recording",
  );
  const activeMediaStreamId = activeStream?.mediasoup_stream_id || activeStream?.id;

  const runAction = async (action: () => Promise<unknown>) => {
    setError("");
    setIsBusy(true);
    try {
      await action();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Command failed.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-row">
          <Cloud size={26} />
          <div>
            <h1>Cloud Console</h1>
            <p>{user.full_name} · {user.role}</p>
          </div>
        </div>
        <div className="top-actions">
          <span className={isConnected ? "sync-pill connected" : "sync-pill"}>
            <CircleDot size={14} />
            {isConnected ? "Sync live" : "Sync waiting"}
          </span>
          <button className="icon-button" title="Refresh" onClick={() => void refresh()}>
            <RefreshCw size={18} />
          </button>
          <button className="icon-button" title="Logout" onClick={onLogout}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <section className="content-grid">
        <section className="panel control-panel">
          <div className="panel-title">
            <Radio size={18} />
            <h2>Stream Control</h2>
          </div>
          <label>
            Device id
            <input value={deviceId} onChange={(event) => setDeviceId(event.target.value)} />
          </label>
          <label>
            Stream title
            <input value={streamTitle} onChange={(event) => setStreamTitle(event.target.value)} />
          </label>
          <div className="button-row">
            <button
              className="secondary-button"
              disabled={isBusy}
              onClick={() => runAction(() => registerDevice(deviceId, deviceId))}
            >
              <Activity size={18} /> Register
            </button>
            <button
              className="primary-button"
              disabled={isBusy}
              onClick={() => runAction(() => startStream(deviceId, streamTitle))}
            >
              <MonitorPlay size={18} /> Start
            </button>
            <button
              className="danger-button"
              disabled={isBusy || !activeStream}
              onClick={() => activeStream && runAction(() => stopStream(activeStream.id))}
            >
              <Square size={18} /> Stop
            </button>
          </div>
          <div className="button-row">
            <button
              className="secondary-button"
              disabled={isBusy || !activeStream}
              onClick={() => activeStream && runAction(() => startRecording(activeStream.id))}
            >
              <Video size={18} /> Record
            </button>
            <button
              className="secondary-button"
              disabled={isBusy || !activeStream}
              onClick={() =>
                activeStream && runAction(() => stopRecording(activeStream.id, activeRecording?.id))
              }
            >
              <Square size={18} /> Stop Rec
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
          <p className="muted">Last sync: {lastSync}</p>
        </section>

        <section className="viewer-panel">
          <div className="viewer-header">
            <div>
              <h2>{activeStream?.title || "Embedded Live Viewer"}</h2>
              <p>
                {activeStream
                  ? `${activeStream.device_id} · ${activeStream.status} · mediasoup WebRTC`
                  : "Start a stream to publish edge video into the cloud viewer."}
              </p>
            </div>
            <select
              value={activeStream?.id || ""}
              onChange={(event) => setSelectedStreamId(event.target.value)}
            >
              {state.streams.map((stream) => (
                <option key={stream.id} value={stream.id}>
                  {stream.title} · {stream.status}
                </option>
              ))}
            </select>
          </div>
          {activeStream ? (
            <LiveStreamViewer streamId={activeMediaStreamId} status={activeStream.status} />
          ) : (
            <div className="empty-viewer">
              <MonitorPlay size={42} />
              <p>Waiting for the edge device to publish a live stream.</p>
            </div>
          )}
        </section>

        <ListPanel title="Devices" items={state.devices.map((device) => ({
          id: device.id,
          title: device.name,
          meta: `${device.status} · streaming ${device.streaming ? "on" : "off"} · recording ${device.recording ? "on" : "off"}`,
        }))} />
        <ListPanel title="Users" items={state.users.map((item) => ({
          id: item.id,
          title: item.full_name,
          meta: `${item.email} · ${item.role}`,
        }))} />
        <ListPanel title="Commands" items={state.commands.slice(0, 8).map((command) => ({
          id: command.id,
          title: `${command.command} ${command.target}`,
          meta: `${command.device_id} · ${command.status}`,
        }))} />
        <section className="panel">
          <div className="panel-title">
            <Video size={18} />
            <h2>Videos</h2>
          </div>
          <div className="video-list">
            {state.videos.map((video) => (
              <article key={video.id} className="video-item">
                <div>
                  <strong>{video.title}</strong>
                  <p>{video.status} · {video.device_id}</p>
                </div>
                {video.playback_url ? (
                  <video src={video.playback_url} controls />
                ) : (
                  <span className="muted">No cloud playback URL</span>
                )}
              </article>
            ))}
            {state.videos.length === 0 && <p className="muted">No recordings yet.</p>}
          </div>
        </section>
      </section>
    </main>
  );
}

function ListPanel({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; title: string; meta: string }>;
}) {
  return (
    <section className="panel">
      <div className="panel-title">
        <Activity size={18} />
        <h2>{title}</h2>
      </div>
      <div className="list">
        {items.map((item) => (
          <article className="list-item" key={item.id}>
            <strong>{item.title}</strong>
            <p>{item.meta}</p>
          </article>
        ))}
        {items.length === 0 && <p className="muted">No data yet.</p>}
      </div>
    </section>
  );
}
