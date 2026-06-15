import { useState } from "react";
import { useAuth, applyTheme } from "@/context/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";
import { User, Palette, Bell, AlertTriangle, ChevronDown, RefreshCw, LogOut, Crown, Lock } from "lucide-react";

const THEMES = [
  { value: "dark", label: "Dark (default)" },
  { value: "light", label: "Light" },
  { value: "ocean", label: "Ocean Blue", premium: true },
  { value: "forest", label: "Forest Green", premium: true },
  { value: "sunset", label: "Sunset Warm", premium: true },
];

export default function Settings({ onUpgrade }) {
  const { user, refreshUser, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [theme, setTheme] = useState(user?.theme || "dark");
  const [goal, setGoal] = useState(user?.goal || 4);
  const [notif, setNotif] = useState(user?.notifications || false);
  const [open, setOpen] = useState("profile");

  const save = async () => {
    // Premium gating for themes
    const selected = THEMES.find((t) => t.value === theme);
    if (selected?.premium && !user?.is_premium) {
      toast.error("That theme is Premium-only", { description: "Upgrade to unlock all themes." });
      onUpgrade && onUpgrade();
      return;
    }
    try {
      await api.put("/preferences", {
        name: name || undefined, theme, goal: parseInt(goal), notifications: notif,
      });
      applyTheme(theme);
      await refreshUser();
      toast.success("Settings saved");
    } catch (e) { toast.error("Save failed"); }
  };

  const onThemePreview = (v) => {
    const t = THEMES.find((x) => x.value === v);
    if (t?.premium && !user?.is_premium) {
      toast("This theme is Premium-only — saving will require upgrade.", { duration: 3000 });
    }
    setTheme(v); applyTheme(v);
  };

  const resetData = async () => {
    if (!window.confirm("Reset all tasks, resources, study sessions, AI history, and pomodoros? This cannot be undone.")) return;
    await api.post("/reset");
    toast.success("All data cleared");
  };

  const Acc = ({ id, icon: Icon, title, danger, children }) => (
    <div className={`acc ${danger ? "danger" : ""}`} data-testid={`acc-${id}`}>
      <button className="acc-head" onClick={() => setOpen(open === id ? "" : id)}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon size={17} color={danger ? "var(--danger)" : "var(--primary)"} />
          {title}
        </span>
        <ChevronDown size={16} style={{ transform: open === id ? "rotate(180deg)" : "none", transition: "0.2s" }} />
      </button>
      {open === id && <div className="acc-body">{children}</div>}
    </div>
  );

  return (
    <div data-testid="settings-section">
      <div className="head-row">
        <div>
          <h1>Settings</h1>
          <div className="sub">Customize your StudySync experience.</div>
        </div>
        {!user?.is_premium && (
          <button className="btn" onClick={onUpgrade} data-testid="settings-upgrade-btn"><Crown size={14} /> Upgrade ₹99</button>
        )}
      </div>

      <div className="settings">
        {user?.is_premium && (
          <div className="card" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, background: "var(--grad-soft)" }}>
            <Crown size={22} color="var(--warning)" />
            <div>
              <strong>You're a Premium member 👑</strong>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Unlimited AI, 500MB storage, all themes — enjoy!</div>
            </div>
          </div>
        )}

        <Acc id="profile" icon={User} title="Profile">
          <div className="field">
            <label>Display Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} data-testid="set-name-input" />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={user?.email || ""} disabled />
          </div>
        </Acc>

        <Acc id="prefs" icon={Palette} title="Appearance & Goals">
          <div className="field">
            <label>Color Theme</label>
            <select value={theme} onChange={(e) => onThemePreview(e.target.value)} data-testid="set-theme-select">
              {THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}{t.premium && !user?.is_premium ? " 🔒 Premium" : ""}
                </option>
              ))}
            </select>
            {!user?.is_premium && <small style={{ color: "var(--text-muted)" }}><Lock size={11} style={{ verticalAlign: "middle" }} /> Ocean / Forest / Sunset require Premium.</small>}
          </div>
          <div className="field">
            <label>Daily Study Goal (hours)</label>
            <input type="number" min="1" max="24" value={goal} onChange={(e) => setGoal(e.target.value)} data-testid="set-goal-input" />
          </div>
        </Acc>

        <Acc id="notifs" icon={Bell} title="Notifications">
          <div className="tg-row">
            <div>
              <strong>Pomodoro & Achievement notifications</strong>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Browser notifications when a session ends.</div>
            </div>
            <label className="sw">
              <input type="checkbox" checked={notif} onChange={(e) => setNotif(e.target.checked)} data-testid="set-notif-toggle" />
              <span className="slider"></span>
            </label>
          </div>
        </Acc>

        <button className="btn" style={{ width: "100%", margin: "18px 0" }} onClick={save} data-testid="save-settings-btn">
          Save All Changes
        </button>

        <Acc id="danger" icon={AlertTriangle} title="Danger Zone" danger>
          <p style={{ color: "var(--text-muted)", marginBottom: 14, fontSize: "0.9rem" }}>
            Irreversible actions. Proceed with caution.
          </p>
          <div className="danger-actions">
            <button className="btn-outline-danger" onClick={logout} data-testid="signout-btn">
              <LogOut size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Sign Out
            </button>
            <button className="btn-outline-danger" onClick={resetData} data-testid="reset-data-btn">
              <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Reset All Data
            </button>
          </div>
        </Acc>
      </div>
    </div>
  );
}
