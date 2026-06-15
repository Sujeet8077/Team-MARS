import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, CheckSquare, Calendar, Timer, FolderOpen, Users,
  Video, Bot, Settings as SettingsIcon, LogOut, GraduationCap, Crown,
  Menu, X,
} from "lucide-react";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "pomodoro", label: "Pomodoro", icon: Timer },
  { id: "resources", label: "Resources", icon: FolderOpen },
  { id: "groups", label: "Study Rooms", icon: Users },
  { id: "meet", label: "Live Meet", icon: Video },
  { id: "tutor", label: "AI Tutor", icon: Bot },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar({ section, onChange, onUpgrade }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  // Close drawer on section change
  useEffect(() => { setOpen(false); }, [section]);

  const pick = (id) => { onChange(id); setOpen(false); };

  return (
    <>
      {/* Mobile topbar */}
      <header className="mob-topbar">
        <button className="ico-btn" onClick={() => setOpen(true)} aria-label="menu" data-testid="open-drawer-btn">
          <Menu size={20} />
        </button>
        <div className="land-logo" style={{ marginBottom: 0, fontSize: "1.1rem" }}>
          <div className="dot"><GraduationCap size={14} /></div>
          StudySync
        </div>
        {!user?.is_premium ? (
          <button className="btn" style={{ padding: "6px 12px", fontSize: "0.78rem" }} onClick={onUpgrade}>
            <Crown size={12} />
          </button>
        ) : <div style={{ width: 36 }} />}
      </header>

      {/* Overlay */}
      {open && <div className="drawer-overlay" onClick={() => setOpen(false)} />}

      <aside className={`side ${open ? "open" : ""}`} data-testid="sidebar">
        <button className="drawer-close mobile-only" onClick={() => setOpen(false)} aria-label="close">
          <X size={20} />
        </button>
        <div className="side-logo">
          <div className="dot"><GraduationCap size={18} /></div>
          StudySync
        </div>

        <ul className="side-nav">
          {NAV.map(({ id, label, icon: Icon }) => (
            <li
              key={id}
              className={section === id ? "active" : ""}
              onClick={() => pick(id)}
              data-testid={`nav-${id}`}
            >
              <Icon size={17} />
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <div className="side-foot">
          <div className="side-user">
            <strong>{user?.name}</strong>
            {user?.is_premium ? (
              <span className="premium-pill"><Crown size={10} /> PREMIUM</span>
            ) : (
              <small>{user?.email}</small>
            )}
          </div>
          {!user?.is_premium && (
            <button className="btn-side primary" onClick={onUpgrade} style={{ marginBottom: 8 }} data-testid="upgrade-btn">
              <Crown size={14} /> Upgrade ₹99
            </button>
          )}
          <button className="btn-side" onClick={logout} data-testid="logout-btn">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
