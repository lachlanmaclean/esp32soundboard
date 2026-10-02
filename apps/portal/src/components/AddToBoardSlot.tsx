"use client";

import { useState } from "react";

export interface LibraryOption {
  id: string;
  displayName: string;
  icon: string | null;
}

/** An open soundboard slot: starts as a plain "+" card, becomes a sound picker once clicked. */
export function AddToBoardSlot({
  action,
  options,
}: {
  action: (formData: FormData) => void;
  options: LibraryOption[];
}) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button type="button" className="sound-tile sound-tile-empty" onClick={() => setExpanded(true)}>
        <span className="sound-tile-plus" aria-hidden="true">+</span>
        <span className="card-subtext">Add a sound</span>
      </button>
    );
  }

  if (options.length === 0) {
    return (
      <div className="sound-tile sound-tile-empty">
        <span className="card-subtext">Your library is empty - upload a sound first.</span>
      </div>
    );
  }

  return (
    <form action={action} className="sound-tile sound-tile-empty">
      <input type="hidden" name="onBoard" value="true" />
      <select name="id" defaultValue={options[0].id} autoFocus>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.icon ? `${option.icon} ` : ""}
            {option.displayName}
          </option>
        ))}
      </select>
      <div className="field-row">
        <button className="btn btn-primary btn-block" type="submit">Add</button>
        <button className="btn btn-block" type="button" onClick={() => setExpanded(false)}>Cancel</button>
      </div>
    </form>
  );
}
