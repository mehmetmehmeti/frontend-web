"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/services/api-client";

export function RecordedVideo({ id }: { id: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void apiFetch<{ url: string }>(`/videos/${id}/playback`, { method: "POST" })
      .then(result => { if (active) setUrl(result.url); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Playback unavailable"); });
    return () => { active = false; };
  }, [id]);
  if (error) return <p className="error-text">{error}</p>;
  return url ? <video src={url} controls playsInline preload="metadata" onError={() => setError("Recording unavailable")} /> : <span className="muted">Loading recording...</span>;
}
