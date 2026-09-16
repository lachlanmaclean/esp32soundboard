"use client";

import { useRef, useState } from "react";

export function VolumeSlider({ soundId, initialVolume }: { soundId: string; initialVolume: number }) {
  const [volume, setVolume] = useState(initialVolume);
  const [saved, setSaved] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(next: number) {
    setVolume(next);
    setSaved(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sounds/${soundId}/volume`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ volume: next }),
        });
        setSaved(res.ok);
      } catch {
        setSaved(false);
      }
    }, 300);
  }

  return (
    <div className="volume-row">
      <span className="volume-icon" aria-hidden="true">
        {volume === 0 ? "🔇" : volume < 100 ? "🔉" : "🔊"}
      </span>
      <input
        type="range"
        className="volume-slider"
        min={0}
        max={200}
        step={5}
        value={volume}
        onChange={(event) => handleChange(Number(event.target.value))}
        aria-label="Volume"
      />
      <span className={`volume-value${saved ? "" : " volume-value-pending"}`}>{volume}%</span>
    </div>
  );
}
