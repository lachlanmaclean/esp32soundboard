"use client";

import { useEffect, useState } from "react";
import { BOARD_SOUND_LIMIT, LIBRARY_SOUND_LIMIT } from "@gooseboard/shared";

interface LibrarySoundOption {
  id: string;
  displayName: string;
  color: string;
  icon: string | null;
}

interface PresetSlotDTO {
  position: number;
  sound: LibrarySoundOption;
}

interface PresetDTO {
  id: string;
  name: string;
  isActive: boolean;
  slots: PresetSlotDTO[];
}

export function DesignerBoard({ librarySounds, tier }: { librarySounds: LibrarySoundOption[]; tier: "NORMAL" | "PRO" }) {
  const isPro = tier === "PRO";
  const slotLimit = isPro ? BOARD_SOUND_LIMIT : LIBRARY_SOUND_LIMIT;

  const [presets, setPresets] = useState<PresetDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [editingPosition, setEditingPosition] = useState<number | null>(null);
  const [creatingPreset, setCreatingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  async function loadPresets(selectId?: string) {
    const res = await fetch("/api/presets");
    const body = await res.json().catch(() => []);
    if (!res.ok) {
      setMessage(body.error ?? "Could not load your board");
      setLoading(false);
      return;
    }

    const list = body as PresetDTO[];
    setPresets(list);
    setSelectedId(selectId ?? list.find((p) => p.isActive)?.id ?? list[0]?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    loadPresets();
  }, []);

  const selected = presets.find((p) => p.id === selectedId) ?? null;

  async function createPreset() {
    if (!newPresetName.trim()) return;
    setMessage(null);

    const res = await fetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPresetName.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? "Could not create preset");
      return;
    }

    setNewPresetName("");
    setCreatingPreset(false);
    await loadPresets(body.id);
  }

  async function activatePreset(id: string) {
    await fetch(`/api/presets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    await loadPresets(id);
  }

  async function deletePreset(id: string) {
    if (presets.length <= 1) return;
    await fetch(`/api/presets/${id}`, { method: "DELETE" });
    await loadPresets();
  }

  // Empty tiles are interchangeable - adding a sound always appends to the
  // next open position server-side rather than targeting the specific tile
  // clicked, so positions can never develop gaps in the first place.
  async function addSound(presetId: string, soundId: string) {
    setMessage(null);
    const res = await fetch(`/api/presets/${presetId}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soundId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? "Could not add sound");
      return;
    }
    setEditingPosition(null);
    await loadPresets(presetId);
  }

  async function editSlot(presetId: string, position: number, soundId: string) {
    setMessage(null);
    const res = await fetch(`/api/presets/${presetId}/slots/${position}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soundId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? "Could not update slot");
      return;
    }
    setEditingPosition(null);
    await loadPresets(presetId);
  }

  async function clearSlot(presetId: string, position: number) {
    await fetch(`/api/presets/${presetId}/slots/${position}`, { method: "DELETE" });
    setEditingPosition(null);
    await loadPresets(presetId);
  }

  if (loading) return <p className="empty-state">Loading...</p>;
  if (!selected) return <p className="empty-state">Could not load your board.</p>;

  // Server keeps slots gap-free (positions 0..n-1), so this is always dense.
  const slotsByPosition = new Map(selected.slots.map((slot) => [slot.position, slot.sound]));
  const filledCount = selected.slots.length;

  const slots = Array.from({ length: slotLimit }, (_, position) => {
    const sound = slotsByPosition.get(position);
    const isEditing = editingPosition === position;

    if (isEditing) {
      return (
        <div key={position} className="gooseboard-slot gooseboard-slot-editing">
          <select
            defaultValue=""
            onChange={(event) => {
              if (!event.target.value) return;
              if (sound) editSlot(selected.id, position, event.target.value);
              else addSound(selected.id, event.target.value);
            }}
            autoFocus
          >
            <option value="" disabled>Pick a sound...</option>
            {librarySounds.map((option) => (
              <option key={option.id} value={option.id}>
                {option.icon ? `${option.icon} ` : ""}
                {option.displayName}
              </option>
            ))}
          </select>
          <div className="gooseboard-slot-editing-actions">
            {sound && (
              <button className="btn btn-danger" type="button" onClick={() => clearSlot(selected.id, position)}>
                Clear
              </button>
            )}
            <button className="btn" type="button" onClick={() => setEditingPosition(null)}>Cancel</button>
          </div>
        </div>
      );
    }

    // Only the next open slot (right after the last filled one) is
    // clickable to add - the rest are just visual "still open" filler so
    // the count is honest without offering N interchangeable add buttons.
    const isNextOpen = !sound && position === filledCount;

    return (
      <button
        key={position}
        type="button"
        className={`gooseboard-slot${sound ? "" : " gooseboard-slot-empty"}`}
        style={sound ? { background: sound.color } : undefined}
        disabled={!sound && !isNextOpen}
        onClick={() => setEditingPosition(position)}
      >
        {sound ? (
          <>
            <span className="gooseboard-slot-icon">{sound.icon ?? "🔊"}</span>
            <span className="gooseboard-slot-name">{sound.displayName}</span>
          </>
        ) : (
          isNextOpen && <span className="gooseboard-slot-plus">+</span>
        )}
      </button>
    );
  });

  return (
    <>
      {message && <p className="alert">{message}</p>}

      {isPro && (
        <>
          <div className="preset-tabs">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`preset-tab${preset.id === selectedId ? " preset-tab-selected" : ""}`}
                onClick={() => setSelectedId(preset.id)}
              >
                {preset.name}
                {preset.isActive && <span className="preset-tab-badge">ACTIVE</span>}
              </button>
            ))}

            {creatingPreset ? (
              <span className="preset-tab preset-tab-new">
                <input
                  type="text"
                  placeholder="Preset name"
                  value={newPresetName}
                  onChange={(event) => setNewPresetName(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && createPreset()}
                  autoFocus
                  style={{ width: 120 }}
                />
                <button className="btn btn-primary" type="button" onClick={createPreset}>Add</button>
                <button className="btn" type="button" onClick={() => setCreatingPreset(false)}>✕</button>
              </span>
            ) : (
              <button className="preset-tab preset-tab-new" type="button" onClick={() => setCreatingPreset(true)}>
                + New preset
              </button>
            )}
          </div>

          <div className="preset-controls">
            {!selected.isActive && (
              <button className="btn btn-primary" type="button" onClick={() => activatePreset(selected.id)}>
                Set as active
              </button>
            )}
            <button
              className="btn btn-danger"
              type="button"
              disabled={presets.length <= 1}
              title={presets.length <= 1 ? "You need at least one preset" : "Delete this preset"}
              onClick={() => deletePreset(selected.id)}
            >
              Delete preset
            </button>
          </div>
        </>
      )}

      <div className={isPro ? "gooseboard-mockup" : undefined}>
        <div className={isPro ? "gooseboard-mockup-screen" : "board-grid-flexible"}>{slots}</div>
      </div>
    </>
  );
}
