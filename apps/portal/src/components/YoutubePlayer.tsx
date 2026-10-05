"use client";

import { useState } from "react";
import { usePlayer } from "./PlayerProvider";

export function YoutubePlayer() {
  const { enqueue } = usePlayer();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<string[]>([]);

  async function load() {
    if (!url.trim()) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/youtube/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      console.log("[youtube] resolve response", { status: res.status, ok: res.ok, body });
      if (!res.ok) throw new Error(body.error ?? `Could not load that video (${res.status})`);

      // Queued immediately - plays straight away if nothing else is
      // playing, or joins the back of the line otherwise. No separate
      // "play in Discord" step.
      enqueue({
        id: `${Date.now()}-${body.streamUrl}`,
        title: body.title,
        streamUrl: body.streamUrl,
        durationSeconds: body.durationSeconds,
      });
      setRecentlyAdded((current) => [body.title, ...current].slice(0, 5));
      setUrl("");
    } catch (error) {
      console.error("[youtube] resolve failed", error);
      setMessage(error instanceof Error ? error.message : "Could not load that video");
    } finally {
      setLoading(false);
    }
  }

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
          {loading ? "Loading..." : "Add to queue"}
        </button>
      </div>

      {message && <p className="alert">{message}</p>}

      {recentlyAdded.length > 0 && (
        <ul className="changelog-list">
          {recentlyAdded.map((title, index) => (
            <li key={index}>Queued: {title}</li>
          ))}
        </ul>
      )}
    </>
  );
}
