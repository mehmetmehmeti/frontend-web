"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize, Minimize } from "lucide-react";

export function VideoSurface({ children, className }: { children: ReactNode; className: string }) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fullscreen = nativeFullscreen || expanded;

  useEffect(() => {
    const update = () => setNativeFullscreen(document.fullscreenElement === surfaceRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  async function toggleFullscreen() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (document.fullscreenElement === surfaceRef.current) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    const surface = surfaceRef.current;
    if (!surface) return;
    if (surface.requestFullscreen) {
      try {
        await surface.requestFullscreen();
        return;
      } catch {
        // Keep the video expandable in browsers that restrict native fullscreen.
      }
    }
    setExpanded(true);
  }

  return (
    <div ref={surfaceRef} className={`video-surface ${className}${expanded ? " video-expanded" : ""}`}>
      {children}
      <button
        className="viewer-tool-button video-fullscreen-button"
        type="button"
        title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        aria-pressed={fullscreen}
        onClick={() => void toggleFullscreen()}
      >
        {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
      </button>
    </div>
  );
}
