import { useEffect, useRef, useState, useCallback } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Play, Pause, Trophy, ClipboardList, FolderOpen, Users, Timer as TimerIcon, Crown, Zap } from "lucide-react";
import { toast } from "sonner";

const fmt = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
};

export default function Dashboard({ onJump, onUpgrade }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    tasks_pending: 0, tasks_total: 0, tasks_completed: 0, completion_pct: 0,
    resources_count: 0, groups_count: 0, study_seconds_today: 0,
    goal_hours: user?.goal || 4, pomodoros_today: 0, is_premium: false,
  });
  const [tasks, setTasks] = useState([]);
  const [resources, setResources] = useState([]);
  const [groups, setGroups] = useState([]);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true); // Auto-start ON
  const tickRef = useRef(null);
  const accumRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const [d, t, r, g] = await Promise.all([
        api.get("/dashboard"), api.get("/tasks"), api.get("/resources"), api.get("/groups"),
      ]);
      setStats(d.data);
      setSeconds((s) => Math.max(s, d.data.study_seconds_today || 0));
      setTasks(t.data); setResources(r.data); setGroups(g.data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-start timer toast
  useEffect(() => {
    toast.success("Study timer started 🎯", { description: "Keep the momentum going!" });
  }, []);

  // Tick + persist
  useEffect(() => {
    if (!running) return;
    tickRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
      accumRef.current += 1;
      if (accumRef.current >= 30) {
        const toSend = accumRef.current;
        accumRef.current = 0;
        api.post("/study/track", { seconds: toSend }).catch(() => {});
      }
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  useEffect(() => {
    return () => {
      if (accumRef.current > 0) {
        api.post("/study/track", { seconds: accumRef.current }).catch(() => {});
        accumRef.current = 0;
      }
    };
  }, []);

  const toggle = () => {
    if (running) {
      if (accumRef.current > 0) {
        api.post("/study/track", { seconds: accumRef.current }).then(refresh).catch(() => {});
        accumRef.current = 0;
      }
      setRunning(false);
      toast("Timer paused", { description: "Take a quick break." });
    } else {
      setRunning(true);
      toast.success("Timer running 🎯");
    }
  };

  const goalSec = (stats.goal_hours || 4) * 3600;
  const progress = Math.min(100, (seconds / goalSec) * 100);

  return (
    <div data-testid="dashboard-section">
      <div className="head-row">
        <div>
          <h1>Hey, {user?.name?.split(" ")[0] || "there"} 👋</h1>
          <div className="sub">Here is your study snapshot for today.</div>
        </div>
        {!user?.is_premium && (
          <button className="btn" onClick={onUpgrade} data-testid="dash-upgrade-btn">
            <Crown size={15} /> Go Premium · ₹99
          </button>
        )}
      </div>

      {/* Goal */}
      <div className="goal-card" data-testid="goal-card">
        <div className="goal-info">
          <h3><Trophy size={18} style={{ verticalAlign: "middle", marginRight: 8, color: "var(--warning)" }} /> Daily Goal: {stats.goal_hours}h</h3>
          <p>Auto-started when you opened the app</p>
        </div>
        <div className="goal-progress">
          <div className="bar"><div style={{ width: `${progress}%` }} /></div>
          <small>{Math.round(progress)}% of your daily goal</small>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="timer-badge" data-testid="study-timer">{fmt(seconds)}</div>
          <button className={`ico-btn ${running ? "active" : ""}`} onClick={toggle} data-testid="timer-toggle-btn" title={running ? "Pause" : "Start"}>
            {running ? <Pause size={18} /> : <Play size={18} />}
          </button>
        </div>
      </div>

      {/* Top: ring + 3 stats */}
      <div className="dash-top">
        <div className="ring-card">
          <div className="ring" style={{ background: `conic-gradient(var(--primary) ${stats.completion_pct * 3.6}deg, var(--surface-2) 0deg)` }}>
            <div>
              <h2 data-testid="completion-pct">{stats.completion_pct}%</h2>
              <small>Completed</small>
            </div>
          </div>
          <small style={{ color: "var(--text-muted)" }}>{stats.tasks_completed} done · {stats.tasks_pending} pending</small>
        </div>
        <div className="dash-stats">
          <div className="stat">
            <h3>Pending Tasks</h3>
            <p data-testid="stat-pending">{stats.tasks_pending}</p>
          </div>
          <div className="stat">
            <h3>Resources</h3>
            <p data-testid="stat-resources">{stats.resources_count}</p>
          </div>
          <div className="stat">
            <h3>Pomodoros today</h3>
            <p data-testid="stat-pomos">{stats.pomodoros_today}</p>
            <div className="delta" style={{ display: "flex", alignItems: "center", gap: 4 }}><Zap size={12} /> Focused</div>
          </div>
        </div>
      </div>

      {/* Widgets */}
      <div className="mix-grid" style={{ marginTop: 18 }}>
        <div className="mix-card">
          <div className="mix-head"><ClipboardList size={18} /> Top Tasks</div>
          {tasks.filter((t) => !t.completed).slice(0, 6).length === 0 ? (
            <div className="empty">All clear 🎉</div>
          ) : tasks.filter((t) => !t.completed).slice(0, 6).map((t) => (
            <div className="mini" key={t.id} onClick={() => onJump("tasks")}>
              <span>{t.desc}</span><span className="tag warn">{t.date || "Anytime"}</span>
            </div>
          ))}
        </div>
        <div className="mix-card">
          <div className="mix-head"><FolderOpen size={18} /> Recent Resources</div>
          {resources.length === 0 ? <div className="empty">Add notes & links →</div> :
            resources.slice(0, 6).map((r) => (
              <div className="mini" key={r.id} onClick={() => onJump("resources")}>
                <span>{r.title}</span><span className="tag info">{r.type}</span>
              </div>
            ))}
        </div>
        <div className="mix-card">
          <div className="mix-head"><Users size={18} /> Study Rooms</div>
          {groups.length === 0 ? <div className="empty">Create your first study room →</div> :
            groups.slice(0, 6).map((g) => (
              <div className="mini" key={g.id} onClick={() => onJump("groups")}>
                <span>{g.name}</span><span className="tag ok">{g.members}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
