"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useErrorBanner } from "./ErrorBannerProvider";

export interface QueueTrack {
  id: string;
  title: string;
  streamUrl: string;
  durationSeconds: number;
}

interface PlayerContextValue {
  queue: QueueTrack[];
  currentIndex: number;
  current: QueueTrack | null;
  playing: boolean;
  currentTime: number;
  enqueue: (track: QueueTrack) => void;
  togglePlay: () => void;
  stop: () => void;
  seek: (seconds: number) => void;
  skipNext: () => void;
  removeFromQueue: (index: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

/**
 * Lives in the root layout (not inside a page's Shell), so this - and the
 * audio element it owns - survives client-side navigation between pages
 * instead of resetting every time someone clicks a different nav item.
 */
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { reportError } = useErrorBanner();

  const current = currentIndex >= 0 ? (queue[currentIndex] ?? null) : null;

  // Sends the now-current track to the user's Discord voice channel. There's
  // no feedback loop back from Discord playback finishing, so the queue's
  // "ends" event is driven entirely by the local preview audio instead - but
  // a failure to even start Discord playback is reported, since otherwise
  // the local preview plays on with no sign anything in Discord went wrong.
  const sendToDiscord = useCallback(
    (track: QueueTrack) => {
      fetch("/api/youtube/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamUrl: track.streamUrl }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.error || `Discord playback failed to start (${res.status})`);
          }
        })
        .catch((error) =>
          reportError(error instanceof Error ? error.message : "Couldn't play this track in Discord."),
        );
    },
    [reportError],
  );

  function playIndex(index: number) {
    setCurrentIndex(index);
    const track = queue[index];
    if (track) sendToDiscord(track);
  }

  const enqueue = useCallback(
    (track: QueueTrack) => {
      setQueue((current) => {
        const next = [...current, track];
        // Nothing was playing - this track becomes current immediately
        // instead of waiting its turn behind an empty queue.
        if (currentIndex === -1) {
          setCurrentIndex(next.length - 1);
          sendToDiscord(track);
        }
        return next;
      });
    },
    [currentIndex, sendToDiscord],
  );

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (playing) audio.pause();
    else audio.play().catch((error) => reportError(error instanceof Error ? error.message : "Couldn't resume playback."));
  }

  function stop() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    fetch("/api/youtube/stop", { method: "POST" }).catch(() =>
      reportError("Couldn't stop Discord playback - it may still be playing."),
    );
  }

  function seek(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
  }

  function skipNext() {
    if (currentIndex + 1 < queue.length) playIndex(currentIndex + 1);
    else {
      setCurrentIndex(-1);
      stop();
    }
  }

  function removeFromQueue(index: number) {
    setQueue((current) => current.filter((_, i) => i !== index));
    if (index < currentIndex) setCurrentIndex((i) => i - 1);
  }

  // New current track - (re)point the audio element at it and autoplay,
  // so both the initial enqueue-while-idle case and auto-advance on "ended"
  // start playback without the user pressing anything else.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    audio.src = current.streamUrl;
    audio.currentTime = 0;
    audio.play().catch((error) =>
      reportError(error instanceof Error ? error.message : "Couldn't start playback in your browser."),
    );
  }, [currentIndex, current, reportError]);

  return (
    <PlayerContext.Provider
      value={{ queue, currentIndex, current, playing, currentTime, enqueue, togglePlay, stop, seek, skipNext, removeFromQueue }}
    >
      <audio
        ref={audioRef}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={skipNext}
        hidden
      />
      {children}
    </PlayerContext.Provider>
  );
}
