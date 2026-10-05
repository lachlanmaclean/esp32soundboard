"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 4, left: rect.right - 140 });
    setMenuOpen(true);
  }

  function confirmWipe() {
    setConfirmOpen(false);
    formRef.current?.requestSubmit();
  }

  return (
    <div className="admin-row-menu">
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn"
        aria-label="More actions"
        onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
      >
        ⋮
      </button>

      {menuOpen &&
        createPortal(
          <>
            <div className="admin-row-menu-backdrop" onClick={() => setMenuOpen(false)} />
            {/* position: fixed + portaled to <body> - rendering this inside the
                admin table (which has overflow-x: auto for horizontal scroll)
                would otherwise clip it and add a scrollbar instead of showing
                the dropdown. */}
            <div className="admin-row-menu-dropdown" style={{ top: menuPos.top, left: menuPos.left }}>
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
          </>,
          document.body,
        )}

      <form ref={formRef} action={wipeAction} hidden>
        <input type="hidden" name="id" value={userId} />
      </form>

      {confirmOpen &&
        createPortal(
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
          </div>,
          document.body,
        )}
    </div>
  );
}
