"use client";

import { useEffect, useState } from "react";
import { BOARD_SOUND_LIMIT } from "@gooseboard/shared";

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

export function DesignerBoard({ librarySounds }: { librarySounds: LibrarySoundOption[] }) {
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
      setMessage(body.error ?? "Could not load presets");
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

  async function renamePreset(id: string, name: string) {
    if (!name.trim()) return;
    await fetch(`/api/presets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    await loadPresets(id);
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

  async function assignSlot(presetId: string, position: number, soundId: string) {
    setMessage(null);
    const res = await fetch(`/api/presets/${presetId}/slots/${position}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soundId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? "Could not assign sound");
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
  if (!selected) return <p className="empty-state">Could not load your presets.</p>;

  const slotsByPosition = new Map(selected.slots.map((slot) => [slot.position, slot.sound]));

  return (
    <>
      {message && <p className="alert">{message}</p>}

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

      <div className="gooseboard-mockup">
        <div className="gooseboard-mockup-screen">
          {Array.from({ length: BOARD_SOUND_LIMIT }, (_, position) => {
            const sound = slotsByPosition.get(position);
            const isEditing = editingPosition === position;

            if (isEditing) {
              return (
                <div key={position} className="gooseboard-slot gooseboard-slot-editing">
                  <select
                    defaultValue={sound?.id ?? ""}
                    onChange={(event) => event.target.value && assignSlot(selected.id, position, event.target.value)}
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

            return (
              <button
                key={position}
                type="button"
                className={`gooseboard-slot${sound ? "" : " gooseboard-slot-empty"}`}
                style={sound ? { background: sound.color } : undefined}
                onClick={() => setEditingPosition(position)}
              >
                {sound ? (
                  <>
                    <span className="gooseboard-slot-icon">{sound.icon ?? "🔊"}</span>
                    <span className="gooseboard-slot-name">{sound.displayName}</span>
                  </>
                ) : (
                  <span className="gooseboard-slot-plus">+</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
