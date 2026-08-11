import { apiFetch } from "@/services/api-client";
import type { Command, Device, Stream, User, Video } from "@/types/domain";

export function listUsers() {
  return apiFetch<{ users: User[] }>("/users");
}

export function listDevices() {
  return apiFetch<{ devices: Device[] }>("/devices");
}

export function registerDevice(id: string, name: string) {
  return apiFetch<{ device: Device }>("/devices", {
    method: "POST",
    body: JSON.stringify({ id, name, status: "online", source_ready: true }),
  });
}

export function listStreams() {
  return apiFetch<{ streams: Stream[] }>("/streams");
}

export function startStream(deviceId: string, title: string) {
  return apiFetch<{ stream: Stream; command_id: string }>("/streams/start", {
    method: "POST",
    body: JSON.stringify({ device_id: deviceId, title }),
  });
}

export function stopStream(streamId: string) {
  return apiFetch<{ stream: Stream; command_id: string }>(`/streams/${streamId}/stop`, {
    method: "POST",
  });
}

export function listVideos() {
  return apiFetch<{ videos: Video[] }>("/videos");
}

export function startRecording(streamId: string) {
  return apiFetch<{ video: Video; command_id: string }>(
    `/streams/${streamId}/recordings/start`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function stopRecording(streamId: string, videoId?: string) {
  return apiFetch<{ video: Video; command_id: string }>(
    `/streams/${streamId}/recordings/stop`,
    { method: "POST", body: JSON.stringify({ video_id: videoId }) },
  );
}

export function listCommands() {
  return apiFetch<{ commands: Command[] }>("/commands");
}
