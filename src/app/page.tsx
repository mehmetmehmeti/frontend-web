"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Activity,
  Film,
  Users,
  Cpu,
  Play,
  Circle,
  CheckCircle2,
  CircleAlert,
  Clock3,
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
import { RecordedVideo } from "@/components/recorded-video";
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
            <h1>Capture Console</h1>
            <p>Web workspace</p>
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
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [lastSync, setLastSync] = useState<string>("Waiting");
  const [view, setView] = useState("live");
  const [search, setSearch] = useState("");

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
    setLastSync(new Date().toLocaleTimeString());
    void refresh().catch(() => undefined);
  });

  useEffect(() => {
    void refresh().catch((caught) => setError(caught instanceof Error ? caught.message : "Load failed."));
    const timer = window.setInterval(() => void refresh().catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const deviceStreams = state.streams.filter(stream => stream.device_id === deviceId);
  const activeStream = deviceStreams.find(stream => ["live", "starting", "stopping"].includes(stream.status));
  const activeRecording = state.videos.find(video => video.stream_id === activeStream?.id && video.status === "recording");
  const device = state.devices.find(item => item.id === deviceId);
  const pending = state.commands.some(command => command.device_id === deviceId && ["pending", "claimed", "processing"].includes(command.status));
  const locked = isBusy || pending;
  const activeMediaStreamId = activeStream?.mediasoup_stream_id || activeStream?.id;
  const recordings = state.videos.filter(video => video.title.toLowerCase().includes(search.toLowerCase()));
  const tabs = [{ id: "live", label: "Live", icon: Radio }, { id: "recordings", label: "Recordings", icon: Film },
    { id: "activity", label: "Activity", icon: Activity }, { id: "devices", label: "Devices", icon: Cpu }, { id: "users", label: "Users", icon: Users }];

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
        <div className="brand-row"><span className="brand-symbol"><Radio size={22} /></span><div><h1>Capture Console</h1><p>Web workspace</p></div></div>
        <div className="top-actions">
          <span className={isConnected ? "connection connected" : "connection"}><CircleDot size={13} />{isConnected ? "Connected" : "Reconnecting"}</span>
          <span className="account-name">{user.full_name}</span>
          <button className="icon-button" title="Refresh data" aria-label="Refresh data" onClick={() => void runAction(refresh)}><RefreshCw size={17} /></button>
          <button className="icon-button" title="Sign out" aria-label="Sign out" onClick={onLogout}><LogOut size={17} /></button>
        </div>
      </header>
      <nav className="workspace-tabs" aria-label="Workspace">
        {tabs.map(tab => <button key={tab.id} className={view === tab.id ? "selected" : ""} aria-current={view === tab.id ? "page" : undefined} onClick={() => setView(tab.id)}><tab.icon size={17} />{tab.label}{tab.id === "recordings" && <span className="count">{state.videos.length}</span>}</button>)}
      </nav>
      <div className="workspace">
        {error && <div role="alert" className="error-banner">{error}<button title="Dismiss error" aria-label="Dismiss error" onClick={() => setError("")}>×</button></div>}
        <div className="section-heading"><div><span className="eyebrow">{view === "live" ? "MONITOR" : "WORKSPACE"}</span><h2>{view === "live" ? "Live stream" : tabs.find(tab => tab.id === view)?.label}</h2></div>
          {view === "live" ? <span className={"state-label " + (activeStream?.status || "idle")}><CircleDot size={13} />{label(activeStream?.status || "idle")}</span> : <span className="muted">{view === "recordings" ? state.videos.length + " recordings" : "Updated " + lastSync}</span>}
        </div>
        {view === "live" && <>
          <div className="studio-layout">
            <section className="monitor-area" aria-label="Live video">
              {activeStream ? <LiveStreamViewer streamId={activeMediaStreamId} status={activeStream.status} /> :
                <div className="empty-viewer"><MonitorPlay size={40} strokeWidth={1.3} /><h3>Stream offline</h3><p>{device?.status === "offline" ? "Edge device offline" : "Camera standing by"}</p></div>}
              <div className="monitor-caption"><div><strong>{activeStream?.title || streamTitle}</strong><span>{deviceId}</span></div><span className="format-label">WebRTC</span></div>
            </section>
            <aside className="capture-controls">
              <h3>Capture</h3>
              <label>Edge device<select aria-label="Edge device" value={deviceId} disabled={locked || !!activeStream} onChange={event => setDeviceId(event.target.value)}>
                {!state.devices.some(d => d.id === deviceId) && <option value={deviceId}>{deviceId}</option>}
                {state.devices.map(d => <option key={d.id} value={d.id}>{d.name || d.id}</option>)}
              </select></label>
              <label>Stream name<input value={activeStream?.title || streamTitle} disabled={!!activeStream || locked} onChange={event => setStreamTitle(event.target.value)} /></label>
              <button className={activeStream ? "danger-button full-width" : "primary-button full-width"} disabled={locked || (!activeStream && device?.status === "offline")} onClick={() => void runAction(() => activeStream ? stopStream(activeStream.id) : startStream(deviceId, streamTitle))}>
                {activeStream ? <Square size={16} /> : <Play size={16} />}{pending ? "Command pending" : activeStream ? "Stop stream" : "Start stream"}
              </button>
              <div className="control-divider" />
              <div className="control-title"><h3>Recording</h3><span className={"state-label " + (activeRecording ? "recording" : "idle")}>{activeRecording ? "Recording" : "Off"}</span></div>
              <button className={activeRecording ? "danger-button full-width" : "secondary-button full-width"} disabled={locked || activeStream?.status !== "live" || activeStream?.user_id !== user.id} onClick={() => activeStream && void runAction(() => activeRecording ? stopRecording(activeStream.id, activeRecording.id) : startRecording(activeStream.id))}>
                {activeRecording ? <Square size={16} /> : <Circle size={16} />}{activeRecording ? "Stop recording" : "Start recording"}
              </button>
              <dl className="session-facts"><div><dt>Device</dt><dd>{label(device?.status || "unknown")}</dd></div><div><dt>Database sync</dt><dd>{isConnected ? "Connected" : "Reconnecting"}</dd></div><div><dt>Last update</dt><dd>{lastSync}</dd></div></dl>
            </aside>
          </div>
          <section className="recent-activity"><div className="section-subheading"><h3>Latest activity</h3><button className="text-button" onClick={() => setView("activity")}>View all</button></div>
            {state.commands.length ? state.commands.slice(0, 3).map(command => <div className="activity-row" key={command.id}>{command.status === "completed" ? <CheckCircle2 size={16} /> : command.status === "failed" ? <CircleAlert size={16} /> : <Clock3 size={16} />}<strong>{label(command.command)} {command.target === "stream" ? "stream" : "recording"}</strong><span className={"state-label " + command.status}>{label(command.status)}</span><time>{new Date(command.created_at).toLocaleTimeString()}</time></div>) : <div className="empty-state">No activity yet</div>}
          </section>
        </>}
        {view === "recordings" && <>
          <div className="collection-toolbar"><input type="search" aria-label="Search recordings" placeholder="Search recordings" value={search} onChange={event => setSearch(event.target.value)} /></div>
          <div className="video-list">{recordings.map(video => <article className="video-item" key={video.id}>
            <div className="recording-media">{video.status === "completed" && video.playback_url ? <RecordedVideo id={video.id} /> : <div className="recording-placeholder"><Film size={28} /><span>{label(video.status)}</span></div>}</div>
            <div className="recording-info"><strong>{video.title}</strong><span className={"state-label " + video.status}>{label(video.status)}</span><p>{new Date(video.created_at).toLocaleString()}</p><p>{video.duration_seconds != null ? video.duration_seconds + " sec · " : ""}{video.device_id}</p></div>
          </article>)}</div>
          {!recordings.length && <div className="empty-state"><Film size={32} /><h3>{search ? "No matching recordings" : "No recordings yet"}</h3></div>}
        </>}
        {view === "activity" && <div className="table-scroll"><table><thead><tr><th>Command</th><th>Device</th><th>Status</th><th>Time</th></tr></thead><tbody>{state.commands.map(command => <tr key={command.id}><td><strong>{label(command.command)} {command.target}</strong>{command.error_message && <p className="error-text">{command.error_message}</p>}</td><td>{command.device_id}</td><td><span className={"state-label " + command.status}>{label(command.status)}</span></td><td>{new Date(command.created_at).toLocaleString()}</td></tr>)}</tbody></table>{!state.commands.length && <div className="empty-state">No commands yet</div>}</div>}
        {view === "devices" && <>
          <form className="device-form" onSubmit={event => { event.preventDefault(); void runAction(() => registerDevice(deviceId, deviceId)); }}><label>Device ID<input required value={deviceId} onChange={event => setDeviceId(event.target.value)} /></label><button className="secondary-button" disabled={isBusy}><UserPlus size={16} />Register device</button></form>
          <div className="table-scroll"><table><thead><tr><th>Device</th><th>Status</th><th>Stream</th><th>Recording</th></tr></thead><tbody>{state.devices.map(d => <tr key={d.id}><td><strong>{d.name}</strong><p>{d.id}</p></td><td><span className={"state-label " + d.status}>{label(d.status)}</span></td><td>{d.streaming ? "Live" : "Off"}</td><td>{d.recording ? "Recording" : "Off"}</td></tr>)}</tbody></table></div>
        </>}
        {view === "users" && <div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>{state.users.map(item => <tr key={item.id}><td><strong>{item.full_name}</strong>{item.id === user.id && <span className="you-label">You</span>}</td><td>{item.email}</td><td>{label(item.role)}</td></tr>)}</tbody></table></div>}
      </div>
      <footer className="workspace-footer"><span>Diploma / Cloud</span><span>{deviceId}</span></footer>
    </main>
  );
}

function label(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
