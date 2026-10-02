"use client";

import { useEffect, useRef, useState } from "react";

interface LibrarySound {
  name: string;
  mp3Url: string;
  detailUrl: string;
}

type RowState = "idle" | "playing" | "error";

export function MemeLibrary() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LibrarySound[]>([]);
  const [trending, setTrending] = useState<LibrarySound[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetch("/api/library/trending")
      .then((res) => res.json())
      .then((body) => setTrending(Array.isArray(body) ? body : []))
      .catch(() => {});
  }, []);

  function setRowState(mp3Url: string, state: RowState, resetAfterMs: number) {
    setRowStates((current) => ({ ...current, [mp3Url]: state }));
    setTimeout(() => setRowStates((current) => ({ ...current, [mp3Url]: "idle" })), resetAfterMs);
  }

  async function runSearch(value: string) {
    if (!value.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/library/search?q=${encodeURIComponent(value)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Search failed");
      setResults(body);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function onQueryChange(value: string) {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 400);
  }

  async function play(sound: LibrarySound) {
    setMessage(null);

    try {
      const res = await fetch("/api/library/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mp3Url: sound.mp3Url }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Playback failed");
      }

      setRowState(sound.mp3Url, "playing", 400);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Playback failed");
      setRowState(sound.mp3Url, "error", 1500);
    }
  }

  const showingSearch = query.trim().length > 0;
  const shownResults = showingSearch ? results : trending;

  return (
    <>
      <input
        type="search"
        placeholder="Search myinstants.com for a sound..."
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className="field-row"
        style={{ width: "100%" }}
      />

      {!showingSearch && trending.length > 0 && <div className="nav-section-label">Trending</div>}

      {message && <p className="alert">{message}</p>}
      {loading && <p className="empty-state">Searching...</p>}

      {!loading && showingSearch && results.length === 0 && (
        <div className="empty-state">No results for &quot;{query}&quot;.</div>
      )}

      {!loading && shownResults.length > 0 && (
        <div className="sound-grid">
          {shownResults.map((sound) => {
            const state = rowStates[sound.mp3Url] ?? "idle";
            return (
              <div key={sound.mp3Url} className={`sound-tile board-tile-${state}`}>
                <div className="sound-tile-head">
                  <span className="sound-tile-name">{sound.name}</span>
                </div>
                <audio controls src={sound.mp3Url} />
                <button className="btn btn-success btn-block" type="button" onClick={() => play(sound)}>
                  ▶ Play in Discord
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
