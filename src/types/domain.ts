export type User = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "operator" | "viewer";
  status: "active" | "disabled";
};

export type Device = {
  id: string;
  name: string;
  status: "offline" | "online" | "streaming" | "error";
  source_ready: boolean;
  streaming: boolean;
  recording: boolean;
  last_error?: string | null;
  last_seen_at?: string | null;
};

export type Stream = {
  id: string;
  user_id: string;
  device_id: string;
  title: string;
  status: "offline" | "starting" | "live" | "stopping" | "ended" | "error";
  playback_url?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  last_error?: string | null;
};

export type Video = {
  id: string;
  user_id: string;
  stream_id?: string | null;
  device_id: string;
  title: string;
  status: "recording" | "uploading" | "completed" | "failed";
  edge_local_path?: string | null;
  cloud_path?: string | null;
  playback_url?: string | null;
  duration_seconds?: number | null;
  size_bytes?: string | null;
  created_at: string;
};

export type Command = {
  id: string;
  device_id: string;
  command: "start" | "stop";
  target: "stream" | "recording";
  status: "pending" | "claimed" | "processing" | "completed" | "failed";
  result_message?: string | null;
  error_message?: string | null;
  created_at: string;
};
