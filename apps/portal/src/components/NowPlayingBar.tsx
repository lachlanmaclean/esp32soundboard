"use client";

import { useState } from "react";
import { usePlayer } from "./PlayerProvider";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function NowPlayingBar() {
  const { queue, currentIndex, current, playing, currentTime, togglePlay, stop, seek, skipNext, removeFromQueue } = usePlayer();
  const [queueOpen, setQueueOpen] = useState(false);

  if (!current) return null;

  const duration = current.durationSeconds;

  return (
    <div className="now-playing-bar">
      {queueOpen && (
        <div className="now-playing-queue">
          {queue.map((track, index) => (
            <div key={track.id} className={`now-playing-queue-row${index === currentIndex ? " now-playing-queue-row-current" : ""}`}>
              <span className="now-playing-queue-title">{track.title}</span>
              {index !== currentIndex && (
                <button className="icon-btn" type="button" onClick={() => removeFromQueue(index)} aria-label="Remove">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="now-playing-bar-inner">
        <div className="now-playing-info">
          <span className="now-playing-title">{current.title}</span>
          <span className="now-playing-time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <input
          type="range"
          className="now-playing-scrubber"
          min={0}
          max={duration || 0}
          step={1}
          value={currentTime}
          onChange={(event) => seek(Number(event.target.value))}
        />

        <div className="now-playing-controls">
          <button className="icon-btn" type="button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
            {playing ? "⏸" : "▶"}
          </button>
          <button className="icon-btn" type="button" onClick={stop} aria-label="Stop">
            ⏹
          </button>
          <button className="icon-btn" type="button" onClick={skipNext} aria-label="Skip" disabled={currentIndex + 1 >= queue.length}>
            ⏭
          </button>
          <button
            className={`icon-btn${queueOpen ? " now-playing-queue-btn-open" : ""}`}
            type="button"
            onClick={() => setQueueOpen((open) => !open)}
            aria-label={`Queue (${queue.length} track${queue.length === 1 ? "" : "s"})`}
          >
            {queue.length}
          </button>
        </div>
      </div>
    </div>
  );
}
