"use client";

import { useState } from "react";

export function NewPolicyRow({ action }: { action: (formData: FormData) => void }) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        type="button"
        className="btn btn-primary"
        style={{ gridColumn: "1 / -1", margin: "8px 10px" }}
        onClick={() => setExpanded(true)}
      >
        + New policy
      </button>
    );
  }

  return (
    <form action={action} className="policy-grid-row">
      <input type="text" name="name" placeholder="New policy name" required autoFocus />
      <input type="number" name="maxSoundsInWindow" defaultValue={30} min={1} />
      <input type="number" name="windowSeconds" defaultValue={60} min={1} />
      <input type="number" name="cooldownSeconds" defaultValue={30} min={0} />
      <input type="number" name="limitedDurationSeconds" defaultValue={600} min={0} />
      <span />
      <span className="admin-actions">
        <button className="btn btn-primary" type="submit">Add</button>
        <button className="btn" type="button" onClick={() => setExpanded(false)}>Cancel</button>
      </span>
    </form>
  );
}
