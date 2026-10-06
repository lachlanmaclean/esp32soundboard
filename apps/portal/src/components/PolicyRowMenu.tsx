"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function PolicyRowMenu({
  policyId,
  policyName,
  deleteAction,
}: {
  policyId: string;
  policyName: string;
  deleteAction: (formData: FormData) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // document.body doesn't exist during SSR - only portal once mounted on the client.
  useEffect(() => setMounted(true), []);

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.right - 120 });
    setMenuOpen(true);
  }

  function confirmDelete() {
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

      {/* This whole subtree, including the hidden delete form, is portaled
          to <body> - it must never be nested inside the page's big
          save-all <form>, which an in-place render would do. Gated on
          `mounted` since document.body doesn't exist during SSR. */}
      {mounted &&
        createPortal(
        <>
          {menuOpen && (
            <>
              <div className="admin-row-menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="admin-row-menu-dropdown" style={{ top: pos.top, left: pos.left }}>
                <button
                  type="button"
                  className="admin-row-menu-item admin-row-menu-item-danger"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                >
                  Delete
                </button>
              </div>
            </>
          )}

          <form ref={formRef} action={deleteAction} hidden>
            <input type="hidden" name="id" value={policyId} />
          </form>

          {confirmOpen && (
            <div className="modal-backdrop" onClick={() => setConfirmOpen(false)}>
              <div className="modal-card" onClick={(event) => event.stopPropagation()}>
                <h3>Delete &quot;{policyName}&quot;?</h3>
                <p className="card-subtext">
                  Users assigned to it fall back to the default policy instead. This cannot be undone.
                </p>
                <div className="modal-actions">
                  <button type="button" className="btn" onClick={() => setConfirmOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-danger" onClick={confirmDelete}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </>,
        document.body,
      )}
    </div>
  );
}
