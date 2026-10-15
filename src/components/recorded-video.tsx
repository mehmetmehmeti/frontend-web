"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { apiFetch } from "@/services/api-client";
import { VideoSurface } from "@/components/video-surface";

export function RecordedVideo({ id }: { id: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    let active = true;
    setUrl("");
    setError("");
    setPlaying(false);
    setPosition(0);
    setDuration(0);
    void apiFetch<{ url: string }>(`/videos/${id}/playback`, { method: "POST" })
      .then(result => { if (active) setUrl(result.url); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Playback unavailable"); });
    return () => { active = false; };
  }, [id]);

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    if (video.ended) video.currentTime = 0;
    await video.play().catch(() => setError("Could not play this recording"));
  }

  function updateDuration() {
    const value = videoRef.current?.duration || 0;
    setDuration(Number.isFinite(value) ? value : 0);
  }

  if (error) return <p className="error-text">{error}</p>;
  return url ? (
    <VideoSurface className="recorded-viewer">
      <video
        ref={videoRef}
        src={url}
        crossOrigin="anonymous"
        playsInline
        muted={muted}
        preload="metadata"
        onLoadedMetadata={updateDuration}
        onDurationChange={updateDuration}
        onTimeUpdate={() => setPosition(videoRef.current?.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onVolumeChange={() => setMuted(videoRef.current?.muted || false)}
        onError={() => setError("Recording unavailable")}
      />
      <div className="recording-controls">
        <button
          className="viewer-tool-button recording-tool-button"
          type="button"
          title={playing ? "Pause" : "Play"}
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => void togglePlayback()}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <input
          type="range"
          aria-label="Seek recording"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(position, duration)}
          disabled={!duration}
          onChange={event => {
            const time = Number(event.target.value);
            if (videoRef.current) videoRef.current.currentTime = time;
            setPosition(time);
          }}
        />
        <span className="recording-time">{formatTime(position)} / {formatTime(duration)}</span>
        <button
          className="viewer-tool-button recording-tool-button"
          type="button"
          title={muted ? "Unmute" : "Mute"}
          aria-label={muted ? "Unmute" : "Mute"}
          onClick={() => setMuted(!muted)}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
    </VideoSurface>
  ) : <span className="muted">Loading recording...</span>;
}

function formatTime(value: number) {
  const seconds = Math.floor(Math.max(0, value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remainder = String(seconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
}
