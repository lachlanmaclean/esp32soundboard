"use client";

import { useRef, useState } from "react";

/**
 * Small icon-only play/pause control, replacing the native <audio controls>
 * bar's scrubber, volume and menu nobody here needs.
 *
 * `volume` is 0-100, applied at the moment playback starts - not reactive
 * mid-playback, since these clips are short enough that doesn't matter.
 */
export function SoundPreviewButton({ src, volume = 100 }: { src: string; volume?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
    } else {
      audio.currentTime = 0;
      audio.volume = Math.min(100, Math.max(0, volume)) / 100;
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
