"use client";

import { useRef, useState } from "react";
import { useErrorBanner } from "@/components/ErrorBannerProvider";

/** Pencil-to-rename control for a sound's display name - purely cosmetic, per-account, doesn't touch the underlying file. */
export function RenameSoundControl({
  soundId,
  initialName,
  icon,
  color,
}: {
  soundId: string;
  initialName: string;
  icon: string | null;
  color: string;
}) {
  const { reportError } = useErrorBanner();
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setDraft(name);
    setEditing(true);
    // Input isn't mounted yet on this same tick - focus it next frame.
    requestAnimationFrame(() => inputRef.current?.select());
  }

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/sounds/${soundId}/name`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not rename sound");
      setName(trimmed);
      setEditing(false);
    } catch (error) {
      reportError(error instanceof Error ? error.message : "Could not rename sound");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <span className="sound-row-name" style={{ color }}>
        <span>{icon ?? "🔊"}</span>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          maxLength={60}
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
            if (event.key === "Escape") setEditing(false);
          }}
          onBlur={save}
          autoFocus
          style={{ minWidth: 0, flex: 1 }}
        />
      </span>
    );
  }

  return (
    <span className="sound-row-name" style={{ color }}>
      <span>{icon ?? "🔊"}</span>
      <span>{name}</span>
      <button
        type="button"
        className="icon-btn rename-btn"
        onClick={startEditing}
        aria-label="Rename"
        title="Rename"
      >
        ✏️
      </button>
    </span>
  );
}
