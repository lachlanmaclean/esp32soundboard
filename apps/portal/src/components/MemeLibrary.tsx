"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SoundPreviewButton } from "@/components/SoundPreviewButton";

interface LibrarySound {
  name: string;
  mp3Url: string;
  detailUrl: string;
}

type RowState = "idle" | "playing" | "added" | "error";

const PAGE_SIZE = 10;

export function MemeLibrary() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LibrarySound[]>([]);
  const [trending, setTrending] = useState<LibrarySound[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetch("/api/library/trending")
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        console.log("[meme-library] trending", { status: res.status, body });
        if (!res.ok) throw new Error(body.error ?? `Trending failed (${res.status})`);
        setTrending(Array.isArray(body) ? body : []);
      })
      .catch((error) => console.error("[meme-library] trending failed", error));
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
      const url = `/api/library/search?q=${encodeURIComponent(value)}`;
      console.log("[meme-library] search request", { url, value });
      const res = await fetch(url);
      const body = await res.json().catch((parseError) => {
        console.error("[meme-library] search response was not valid JSON", parseError);
        return {};
      });
      console.log("[meme-library] search response", { status: res.status, ok: res.ok, body });
      if (!res.ok) throw new Error(body.error ?? `Search failed (${res.status})`);
      setResults(body);
    } catch (error) {
      console.error("[meme-library] search failed", error);
      setMessage(error instanceof Error ? error.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setPage(0);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 400);
  }

  async function play(sound: LibrarySound) {
    setMessage(null);

    try {
      console.log("[meme-library] play request", sound);
      const res = await fetch("/api/library/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mp3Url: sound.mp3Url }),
      });

      const body = await res.json().catch(() => ({}));
      console.log("[meme-library] play response", { status: res.status, ok: res.ok, body });
      if (!res.ok) throw new Error(body.error ?? `Playback failed (${res.status})`);

      setRowState(sound.mp3Url, "playing", 400);
    } catch (error) {
      console.error("[meme-library] play failed", error);
      setMessage(error instanceof Error ? error.message : "Playback failed");
      setRowState(sound.mp3Url, "error", 1500);
    }
  }

  async function addToLibrary(sound: LibrarySound) {
    setMessage(null);

    try {
      console.log("[meme-library] import request", sound);
      const res = await fetch("/api/library/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mp3Url: sound.mp3Url, displayName: sound.name }),
      });

      const body = await res.json().catch(() => ({}));
      console.log("[meme-library] import response", { status: res.status, ok: res.ok, body });
      if (!res.ok) throw new Error(body.error ?? `Could not add to library (${res.status})`);

      setRowState(sound.mp3Url, "added", 1500);
      router.refresh();
    } catch (error) {
      console.error("[meme-library] import failed", error);
      setMessage(error instanceof Error ? error.message : "Could not add to library");
      setRowState(sound.mp3Url, "error", 1500);
    }
  }

  const showingSearch = query.trim().length > 0;
  const shownResults = showingSearch ? results : trending;
  const pageCount = Math.ceil(shownResults.length / PAGE_SIZE) || 1;
  const pageResults = shownResults.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

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

      {!loading && pageResults.length > 0 && (
        <div className="sound-list">
          {pageResults.map((sound) => {
            const state = rowStates[sound.mp3Url] ?? "idle";
            return (
              <div key={sound.mp3Url} className="sound-row">
                <span className="sound-row-name">{sound.name}</span>
                <div className="sound-row-actions">
                  <SoundPreviewButton src={sound.mp3Url} />
                  <button className="btn btn-success" type="button" onClick={() => play(sound)}>
                    ▶ Play on Discord
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={state === "added"}
                    onClick={() => addToLibrary(sound)}
                  >
                    {state === "added" ? "✓ Added" : "+ Add to Library"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && shownResults.length > PAGE_SIZE && (
        <div className="pagination">
          <button className="btn" type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            ← Prev
          </button>
          <span className="card-subtext">
            Page {page + 1} of {pageCount}
          </span>
          <button
            className="btn"
            type="button"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}
