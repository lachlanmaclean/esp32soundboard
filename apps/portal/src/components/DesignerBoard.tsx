"use client";

import { useEffect, useState } from "react";
import { BOARD_SOUND_LIMIT, LIBRARY_SOUND_LIMIT } from "@gooseboard/shared";

interface LibrarySoundOption {
  id: string;
  displayName: string;
  color: string;
  icon: string | null;
}

// Fixed palette, not a free-form color picker - the CYD's screen reads best
// with a small set of distinct, high-contrast colors rather than anything
// a picker could produce.
const SLOT_COLORS = ["#5865F2", "#23A55A", "#F23F43", "#FAA61A", "#EB459E"];

interface PresetSlotDTO {
  position: number;
  sound: LibrarySoundOption;
  color: string | null;
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
  const [editColor, setEditColor] = useState(SLOT_COLORS[0]);
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
  async function addSound(presetId: string, soundId: string, color: string | null) {
    setMessage(null);
    const res = await fetch(`/api/presets/${presetId}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soundId, color }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? "Could not add sound");
      return;
    }
    setEditingPosition(null);
    await loadPresets(presetId);
  }

  async function editSlot(presetId: string, position: number, soundId: string, color: string | null) {
    setMessage(null);
    const res = await fetch(`/api/presets/${presetId}/slots/${position}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soundId, color }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? "Could not update slot");
      return;
    }
    setEditingPosition(null);
    await loadPresets(presetId);
  }

  async function setSlotColor(presetId: string, position: number, color: string) {
    setEditColor(color);
    await fetch(`/api/presets/${presetId}/slots/${position}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
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
  const slotsByPosition = new Map(selected.slots.map((slot) => [slot.position, slot]));
  const filledCount = selected.slots.length;

  function openEditor(position: number, slot: PresetSlotDTO | undefined) {
    setEditColor(slot?.color ?? slot?.sound.color ?? SLOT_COLORS[0]);
    setEditingPosition(position);
  }

  // Pro mirrors the physical device: a fixed 4x2 grid, every slot visible
  // (filled or not), since that's literally what the hardware's screen
  // looks like.
  const proSlots = Array.from({ length: slotLimit }, (_, position) => {
    const slot = slotsByPosition.get(position);
    const sound = slot?.sound;

    // Only the next open slot (right after the last filled one) is
    // clickable to add - the rest are just visual "still open" filler so
    // the count is honest without offering N interchangeable add buttons.
    const isNextOpen = !sound && position === filledCount;

    return (
      <button
        key={position}
        type="button"
        className={`gooseboard-slot${sound ? "" : " gooseboard-slot-empty"}`}
        style={sound ? { background: slot!.color ?? sound.color } : undefined}
        disabled={!sound && !isNextOpen}
        onClick={() => openEditor(position, slot)}
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

  // Normal has no device to mirror - just show the sounds that are
  // actually there, styled exactly like the real tap-to-play board, plus
  // one "+" tile at the end instead of a wall of up-to-30 empty placeholders.
  const normalSlots = [
    ...selected.slots.map((slot) => {
      const position = slot.position;
      return (
        <button
          key={position}
          type="button"
          className="board-tile"
          style={{ ["--tile-color" as string]: slot.color ?? slot.sound.color }}
          onClick={() => openEditor(position, slot)}
        >
          <span className="board-tile-icon">{slot.sound.icon ?? "🔊"}</span>
          <span className="board-tile-name">{slot.sound.displayName}</span>
        </button>
      );
    }),
    filledCount < slotLimit && (
      <button
        key="add"
        type="button"
        className="board-tile board-tile-add"
        onClick={() => openEditor(filledCount, undefined)}
      >
        <span className="gooseboard-slot-plus">+</span>
      </button>
    ),
  ].filter(Boolean);

  const editingSlot = editingPosition !== null ? slotsByPosition.get(editingPosition) : undefined;
  const editingSound = editingSlot?.sound;

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

      {isPro ? (
        <div className="gooseboard-mockup">
          <div className="gooseboard-mockup-screen">{proSlots}</div>
        </div>
      ) : (
        <div className="board-grid">{normalSlots}</div>
      )}

      {editingPosition !== null && (
        <div className="modal-backdrop" onClick={() => setEditingPosition(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>{editingSound ? "Edit slot" : "Add a sound"}</h3>

            <div className="designer-modal-body">
              <select
                defaultValue={editingSound?.id ?? ""}
                onChange={(event) => {
                  if (!event.target.value) return;
                  if (editingSound) editSlot(selected!.id, editingPosition, event.target.value, editColor);
                  else addSound(selected!.id, event.target.value, editColor);
                }}
                autoFocus
                className="btn-block"
              >
                {!editingSound && <option value="" disabled>Pick a sound...</option>}
                {librarySounds.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.icon ? `${option.icon} ` : ""}
                    {option.displayName}
                  </option>
                ))}
              </select>

              <div className="color-swatch-row" role="group" aria-label="Slot color">
                {SLOT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch${color === editColor ? " color-swatch-selected" : ""}`}
                    style={{ background: color }}
                    aria-label={color}
                    aria-pressed={color === editColor}
                    onClick={() =>
                      editingSound ? setSlotColor(selected!.id, editingPosition, color) : setEditColor(color)
                    }
                  />
                ))}
              </div>
            </div>

            <div className="modal-actions">
              {editingSound && (
                <button
                  className="btn btn-danger"
                  type="button"
                  onClick={() => clearSlot(selected!.id, editingPosition)}
                >
                  Clear
                </button>
              )}
              <button className="btn" type="button" onClick={() => setEditingPosition(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
