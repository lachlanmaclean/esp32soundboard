"use client";

import { useState } from "react";

export interface BoardSound {
  id: string;
  displayName: string;
  color: string;
  icon: string | null;
}

type TileState = "idle" | "playing" | "error";

export function SoundBoard({ sounds }: { sounds: BoardSound[] }) {
  const [states, setStates] = useState<Record<string, TileState>>({});
  const [pressed, setPressed] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);

  function setTile(id: string, state: TileState, resetAfterMs: number) {
    setStates((current) => ({ ...current, [id]: state }));
    setTimeout(() => setStates((current) => ({ ...current, [id]: "idle" })), resetAfterMs);
  }

  function setPressedState(id: string, isPressed: boolean) {
    setPressed((current) => ({ ...current, [id]: isPressed }));
  }

  async function play(id: string) {
    setMessage(null);

    try {
      const res = await fetch(`/api/play/${id}`, { method: "POST" });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Playback failed");
      }

      setTile(id, "playing", 400);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Playback failed");
      setTile(id, "error", 1500);
    }
  }

  if (sounds.length === 0) {
    return (
      <div className="empty-state">
        No sounds yet. Add some from the <a href="/">dashboard</a> first.
      </div>
    );
  }

  return (
    <>
      {message && <p className="alert board-alert">{message}</p>}

      <div className="board-grid">
        {sounds.map((sound) => {
          const isPressed = pressed[sound.id] ?? false;
          const tileState = states[sound.id] ?? "idle";

          return (
            <button
              key={sound.id}
              type="button"
              className={`board-tile board-tile-${tileState}${isPressed ? " board-tile-pressed" : ""}`}
              style={{ ["--tile-color" as string]: sound.color }}
              // click, not pointerdown: some mobile browsers cancel a
              // pointerdown if they think a scroll might start, which made
              // taps silently do nothing. Pointer down/up/cancel/leave still
              // drive the instant "pressed" color change below, so the tile
              // reacts the moment you touch it either way.
              onPointerDown={() => setPressedState(sound.id, true)}
              onPointerUp={() => setPressedState(sound.id, false)}
              onPointerCancel={() => setPressedState(sound.id, false)}
              onPointerLeave={() => setPressedState(sound.id, false)}
              onClick={() => play(sound.id)}
            >
              <span className="board-tile-icon">{sound.icon ?? "🔊"}</span>
              <span className="board-tile-name">{sound.displayName}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
