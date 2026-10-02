"use client";

import { useRef, useState } from "react";

/** Small icon-only play/pause control, replacing the native <audio controls> bar's scrubber, volume and menu nobody here needs. */
export function SoundPreviewButton({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
    } else {
      audio.currentTime = 0;
      audio.play();
    }
  }

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        onClick={toggle}
        aria-label={playing ? "Pause preview" : "Play preview"}
        title={playing ? "Pause" : "Play"}
      >
        {playing ? "⏸" : "▶"}
      </button>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        hidden
      />
    </>
  );
}
