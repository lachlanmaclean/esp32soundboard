"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Policy {
  id: string;
  name: string;
}

export function PolicyPicker({
  userId,
  policies,
  currentPolicyName,
  assignAction,
}: {
  userId: string;
  policies: Policy[];
  currentPolicyName: string;
  assignAction: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function openPicker() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left });
    setQuery("");
    setOpen(true);
  }

  function choose(policyId: string) {
    setOpen(false);
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem("policyId") as HTMLInputElement).value = policyId;
    form.requestSubmit();
  }

  const filtered = policies.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="admin-row-menu">
      <button ref={buttonRef} type="button" className="btn" onClick={openPicker}>
        {currentPolicyName}
      </button>

      <form ref={formRef} action={assignAction} hidden>
        <input type="hidden" name="id" value={userId} />
        <input type="hidden" name="policyId" />
      </form>

      {open &&
        createPortal(
          <>
            <div className="admin-row-menu-backdrop" onClick={() => setOpen(false)} />
            <div className="policy-picker-dropdown" style={{ top: pos.top, left: pos.left }}>
              <input
                type="text"
                placeholder="Search policies..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
              />
              <div className="policy-picker-list">
                {filtered.length === 0 && <div className="policy-picker-empty">No matching policies</div>}
                {filtered.map((policy) => (
                  <button
                    key={policy.id}
                    type="button"
                    className="admin-row-menu-item"
                    onClick={() => choose(policy.id)}
                  >
                    {policy.name}
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
