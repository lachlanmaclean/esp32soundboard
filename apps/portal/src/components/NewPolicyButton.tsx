"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Small "+" button for the page header, opening a modal with the create form - not an inline grid row. */
export function NewPolicyButton({ action }: { action: (formData: FormData) => void }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // document.body doesn't exist during SSR - only portal once mounted on the client.
  useEffect(() => setMounted(true), []);

  return (
    <>
      <button type="button" className="icon-btn" aria-label="New policy" title="New policy" onClick={() => setOpen(true)}>
        +
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setOpen(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <h3>New policy</h3>
              <form action={action} onSubmit={() => setOpen(false)} className="new-policy-form">
                <label>
                  Name
                  <input type="text" name="name" placeholder="Policy name" required autoFocus />
                </label>
                <div className="new-policy-form-grid">
                  <label>
                    Max sounds (0 = no limit)
                    <input type="number" name="maxSoundsInWindow" defaultValue={30} min={0} />
                  </label>
                  <label>
                    Window (s)
                    <input type="number" name="windowSeconds" defaultValue={60} min={1} />
                  </label>
                  <label>
                    Cooldown (s)
                    <input type="number" name="cooldownSeconds" defaultValue={30} min={0} />
                  </label>
                  <label>
                    Limited for (s)
                    <input type="number" name="limitedDurationSeconds" defaultValue={600} min={0} />
                  </label>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Add policy
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
