import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Coffee, Zap, Trophy } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

const PHASES = {
  focus: { label: "Focus", minutes: 25, icon: Zap, color: "var(--primary)" },
  short: { label: "Short Break", minutes: 5, icon: Coffee, color: "var(--accent)" },
  long:  { label: "Long Break", minutes: 15, icon: Coffee, color: "var(--success)" },
};

export default function Pomodoro() {
  const [phase, setPhase] = useState("focus");
  const [secLeft, setSecLeft] = useState(PHASES.focus.minutes * 60);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({ total: 0, today: 0 });
  const tickRef = useRef(null);
  const completedRef = useRef(0);

  const fetchStats = async () => {
    try {
      const { data } = await api.get("/pomodoro/stats");
      setStats(data);
    } catch {}
  };
  useEffect(() => { fetchStats(); }, []);

  // Request notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!running) { clearInterval(tickRef.current); return; }
    tickRef.current = setInterval(() => {
      setSecLeft((s) => {
        if (s <= 1) {
          // Phase complete
          clearInterval(tickRef.current);
          handlePhaseEnd();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
    // eslint-disable-next-line
  }, [running, phase]);

  const handlePhaseEnd = async () => {
    setRunning(false);
    const beep = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="); // tiny click
    beep.play().catch(() => {});
    if (phase === "focus") {
      try {
        const { data } = await api.post("/pomodoro/complete", { duration_minutes: PHASES.focus.minutes, completed: true });
        toast.success(`🎯 Pomodoro complete! (#${data.total})`);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Pomodoro complete! 🎯", { body: "Time for a break. Stretch, hydrate." });
        }
        for (const a of data.new_achievements || []) {
          toast.success(`🏆 Achievement: ${a.title}`, { description: a.desc, duration: 6000 });
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`🏆 ${a.title}`, { body: a.desc });
          }
        }
        completedRef.current += 1;
        // Auto move to break
        const nextPhase = completedRef.current % 4 === 0 ? "long" : "short";
        switchPhase(nextPhase);
        fetchStats();
      } catch (e) {
        toast.error("Could not log pomodoro");
      }
    } else {
      toast("Break over — back to it 💪");
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Break's over!", { body: "Let's get back to focus mode." });
      }
      switchPhase("focus");
    }
  };

  const switchPhase = (p) => {
    setPhase(p);
    setSecLeft(PHASES[p].minutes * 60);
    setRunning(false);
  };

  const fmtTime = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  const total = PHASES[phase].minutes * 60;
  const pct = ((total - secLeft) / total) * 100;
  const PhaseIco = PHASES[phase].icon;

  return (
    <div data-testid="pomodoro-section">
      <div className="head-row">
        <div>
          <h1>Pomodoro</h1>
          <div className="sub">Lock in for 25-min sprints. Earn achievements as you go.</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 22, flexWrap: "wrap" }}>
        {Object.entries(PHASES).map(([k, v]) => (
          <button
            key={k}
            className={k === phase ? "btn" : "btn secondary"}
            onClick={() => switchPhase(k)}
            data-testid={`phase-${k}`}
          >
            <v.icon size={14} /> {v.label}
          </button>
        ))}
      </div>

      <div className="pomo-card" data-testid="pomo-card">
        <div className="pomo-phase">
          <PhaseIco size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
          {PHASES[phase].label}
        </div>
        <div className="pomo-time" data-testid="pomo-time">{fmtTime(secLeft)}</div>
        <div className="goal-progress" style={{ marginBottom: 28, padding: "0 20px" }}>
          <div className="bar"><div style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="pomo-actions">
          <button className="btn" onClick={() => setRunning((r) => !r)} data-testid="pomo-toggle-btn">
            {running ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Start</>}
          </button>
          <button className="btn secondary" onClick={() => switchPhase(phase)} data-testid="pomo-reset-btn">
            <RotateCcw size={15} /> Reset
          </button>
        </div>
        <div className="pomo-stats">
          <div><strong>{stats.today}</strong>Today</div>
          <div><strong>{stats.total}</strong><Trophy size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />All-time</div>
        </div>
      </div>
    </div>
  );
}
