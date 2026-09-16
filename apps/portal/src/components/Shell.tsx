import { buildBotInviteUrl } from "@/lib/discord";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export function Shell({
  userName,
  userImage,
  title,
  titleIcon,
  children,
}: {
  userName: string;
  userImage?: string | null;
  title: string;
  titleIcon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="brand-mark">🪿</span>
          <span className="brand-name">Gooseboard</span>
        </div>

        <div>
          <div className="nav-section-label">Dashboard</div>
          <ul className="nav-list">
            <li>
              <a className="nav-item" href="/board">
                <span className="nav-icon">🎛️</span>
                <span className="nav-item-label">Soundboard</span>
              </a>
            </li>
            <li>
              <a className="nav-item" href="#sounds">
                <span className="nav-icon">🔊</span>
                <span className="nav-item-label">Sound library</span>
              </a>
            </li>
            <li>
              <a className="nav-item" href="#devices">
                <span className="nav-icon">📟</span>
                <span className="nav-item-label">Devices</span>
              </a>
            </li>
          </ul>
        </div>

        <div>
          <div className="nav-section-label">Discord</div>
          <ul className="nav-list">
            <li>
              <a
                className="nav-item"
                href={buildBotInviteUrl()}
                target="_blank"
                rel="noopener noreferrer"
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
  );
}
