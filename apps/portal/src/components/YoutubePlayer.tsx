"use client";

import { useRef, useState } from "react";

interface Resolved {
  title: string;
  durationSeconds: number;
  streamUrl: string;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function YoutubePlayer() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [discordState, setDiscordState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const audioRef = useRef<HTMLAudioElement>(null);

  async function load() {
    if (!url.trim()) return;

    setLoading(true);
    setMessage(null);
    setResolved(null);
    setPlaying(false);
    setDiscordState("idle");

    try {
      const res = await fetch("/api/youtube/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      console.log("[youtube] resolve response", { status: res.status, ok: res.ok, body });
      if (!res.ok) throw new Error(body.error ?? `Could not load that video (${res.status})`);
      setResolved(body);
    } catch (error) {
      console.error("[youtube] resolve failed", error);
      setMessage(error instanceof Error ? error.message : "Could not load that video");
    } finally {
      setLoading(false);
    }
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
  }

  function stop() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
  }

  async function playOnDiscord() {
    if (!resolved) return;
    setDiscordState("sending");
    setMessage(null);

    try {
      const res = await fetch("/api/youtube/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamUrl: resolved.streamUrl }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Playback failed (${res.status})`);
      setDiscordState("sent");
      setTimeout(() => setDiscordState("idle"), 2000);
    } catch (error) {
      console.error("[youtube] play-on-discord failed", error);
      setMessage(error instanceof Error ? error.message : "Playback failed");
      setDiscordState("error");
    }
  }

  const duration = audioRef.current?.duration || resolved?.durationSeconds || 0;

  return (
    <>
      <div className="field-row">
        <input
          type="url"
          placeholder="Paste a YouTube video URL..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && load()}
          style={{ flex: 1, minWidth: 200 }}
        />
        <button className="btn btn-primary" type="button" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Load"}
        </button>
      </div>

      {message && <p className="alert">{message}</p>}

      {resolved && (
        <div className="yt-player">
          <div className="yt-player-title">{resolved.title}</div>

          <audio
            ref={audioRef}
            src={resolved.streamUrl}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            hidden
          />

          <div className="yt-player-controls">
            <button className="icon-btn" type="button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
              {playing ? "⏸" : "▶"}
            </button>
            <button className="icon-btn" type="button" onClick={stop} aria-label="Stop">
              ⏹
            </button>
            <span className="yt-player-time">{formatTime(currentTime)}</span>
            <input
              type="range"
              className="volume-slider"
              min={0}
              max={duration || 0}
              step={1}
              value={currentTime}
              onChange={(event) => seek(Number(event.target.value))}
              style={{ flex: 1 }}
            />
            <span className="yt-player-time">{formatTime(duration)}</span>
          </div>

          <button className="btn btn-success btn-block" type="button" onClick={playOnDiscord} disabled={discordState === "sending"}>
            {discordState === "sent" ? "✓ Playing in Discord" : "▶ Play in Discord"}
          </button>
        </div>
      )}
    </>
  );
}
