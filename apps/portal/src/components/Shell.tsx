"use client";

import { useEffect, useState } from "react";
import { buildBotInviteUrl } from "@/lib/discord";
import { ChangelogModal } from "./ChangelogModal";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export function Shell({
  userName,
  userImage,
  title,
  titleIcon,
  tier,
  isImpersonating = false,
  isOwner = false,
  showChangelog = false,
  children,
}: {
  userName: string;
  userImage?: string | null;
  title: string;
  titleIcon: string;
  /** Normal-tier users have no physical device, so device-related nav/copy is hidden for them entirely. */
  tier: "NORMAL" | "PRO";
  /** True when the owner is viewing as this user via admin impersonation. */
  isImpersonating?: boolean;
  /** True for the real owner account (never true while impersonating) - shows the Admin nav link. */
  isOwner?: boolean;
  /** Computed server-side from shouldShowChangelog() - whether to pop up the "what's new" modal. */
  showChangelog?: boolean;
  children: React.ReactNode;
}) {
  const isPro = tier === "PRO";
  const [menuOpen, setMenuOpen] = useState(false);
  const [endingImpersonation, setEndingImpersonation] = useState(false);

  async function returnToAdmin() {
    setEndingImpersonation(true);
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    window.location.href = "/admin";
  }

  // Locks background scroll while the drawer is open, and guarantees it
  // never gets stuck locked (e.g. navigating away mid-animation).
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      {!isImpersonating && <ChangelogModal shouldShow={showChangelog} />}
      {isImpersonating && (
        <div className="impersonation-banner">
          Viewing as <strong>{userName}</strong>
          <button type="button" className="btn" onClick={returnToAdmin} disabled={endingImpersonation}>
            {endingImpersonation ? "Returning..." : "Return to admin"}
          </button>
        </div>
      )}
      <div className="shell">
      <button
        type="button"
        className="menu-toggle"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        aria-controls="sidebar-nav"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className={`menu-icon${menuOpen ? " menu-icon-open" : ""}`} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      <div
        className={`drawer-backdrop${menuOpen ? " drawer-backdrop-visible" : ""}`}
        onClick={closeMenu}
        aria-hidden="true"
      />

      <aside id="sidebar-nav" className={`sidebar${menuOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-header">
          <span className="brand-mark">🪿</span>
          <span className="brand-name">Gooseboard</span>
        </div>

        <div>
          <div className="nav-section-label">Dashboard</div>
          <ul className="nav-list">
            <li>
              <a className="nav-item" href="/" onClick={closeMenu}>
                <span className="nav-icon">🏠</span>
                <span className="nav-item-label">Dashboard</span>
              </a>
            </li>
            <li>
              <a className="nav-item" href="/designer" onClick={closeMenu}>
                <span className="nav-icon">🧩</span>
                <span className="nav-item-label">Designer</span>
              </a>
            </li>
            <li>
              <a className="nav-item" href="/library" onClick={closeMenu}>
                <span className="nav-icon">🔊</span>
                <span className="nav-item-label">Sound library</span>
              </a>
            </li>
            <li>
              <a className="nav-item" href="/meme-library" onClick={closeMenu}>
                <span className="nav-icon">🤣</span>
                <span className="nav-item-label">Meme library</span>
              </a>
            </li>
            {isPro && (
              <li>
                <a className="nav-item" href="/devices" onClick={closeMenu}>
                  <span className="nav-icon">📟</span>
                  <span className="nav-item-label">Devices</span>
                </a>
              </li>
            )}
          </ul>
        </div>

        <div>
          <div className="nav-section-label">Tools</div>
          <ul className="nav-list">
            <li>
              <a className="nav-item" href="/board" onClick={closeMenu}>
                <span className="nav-icon">🎛️</span>
                <span className="nav-item-label">Soundboard</span>
              </a>
            </li>
            {isPro && (
              <li>
                <a className="nav-item" href="/youtube" onClick={closeMenu}>
                  <span className="nav-icon">📺</span>
                  <span className="nav-item-label">YouTube</span>
                </a>
              </li>
            )}
          </ul>
        </div>

        {isOwner && (
          <div>
            <div className="nav-section-label">Owner</div>
            <ul className="nav-list">
              <li>
                <a className="nav-item" href="/admin" onClick={closeMenu}>
                  <span className="nav-icon">🛠️</span>
                  <span className="nav-item-label">Admin</span>
                </a>
              </li>
            </ul>
          </div>
        )}

        <div>
          <div className="nav-section-label">Discord</div>
          <ul className="nav-list">
            <li>
              <a
                className="nav-item"
                href={buildBotInviteUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMenu}
              >
                <span className="nav-icon">➕</span>
                <span className="nav-item-label">Add bot to a server</span>
              </a>
            </li>
          </ul>
        </div>

        <div className="sidebar-footer">
          <div className="user-card">
            {userImage ? (
              <img className="avatar" src={userImage} alt="" />
            ) : (
              <span className="avatar">{initials(userName)}</span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-card-name">{userName}</div>
              <a className="user-card-action" href="/api/auth/signout">
                Sign out
              </a>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-icon">{titleIcon}</span>
          <h1>{title}</h1>
        </header>
        <div className="content">{children}</div>
      </div>
      </div>
    </>
  );
}
