"use client";

import { useRef, useState } from "react";

export function AdminRowMenu({
  userId,
  username,
  wipeAction,
}: {
  userId: string;
  username: string;
  wipeAction: (formData: FormData) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function confirmWipe() {
    setConfirmOpen(false);
    formRef.current?.requestSubmit();
  }

  return (
    <div className="admin-row-menu">
      <button
        type="button"
        className="icon-btn"
        aria-label="More actions"
        onClick={() => setMenuOpen((open) => !open)}
      >
        ⋮
      </button>

      {menuOpen && (
        <>
          <div className="admin-row-menu-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="admin-row-menu-dropdown">
            <button
              type="button"
              className="admin-row-menu-item admin-row-menu-item-danger"
              onClick={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
            >
              Wipe content
            </button>
          </div>
        </>
      )}

      <form ref={formRef} action={wipeAction} hidden>
        <input type="hidden" name="id" value={userId} />
      </form>

      {confirmOpen && (
        <div className="modal-backdrop" onClick={() => setConfirmOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>Wipe {username}&apos;s content?</h3>
            <p className="card-subtext">
              This permanently deletes all of their sounds and presets. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmWipe}>
                Wipe content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
