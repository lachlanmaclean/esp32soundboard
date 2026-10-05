"use client";

import { useState } from "react";
import { CHANGELOG } from "@/lib/changelog";

/** `shouldShow` is computed server-side (user.lastSeenChangelogVersion vs. the latest entry, and the owner's mute flag) so the admin page can see exactly the same state this reads. */
export function ChangelogModal({ shouldShow }: { shouldShow: boolean }) {
  const [open, setOpen] = useState(shouldShow);

  async function dismiss() {
    setOpen(false);
    try {
      await fetch("/api/changelog/seen", { method: "POST" });
    } catch (error) {
      console.error("[changelog] failed to record as seen", error);
    }
  }

  if (!open) return null;

  const latest = CHANGELOG[0];

  return (
    <div className="modal-backdrop" onClick={dismiss}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <h3>🪿 What&apos;s new</h3>
        <p className="card-subtext">
          {latest.title} · {latest.date}
        </p>
        <ul className="changelog-list">
          {latest.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={dismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
