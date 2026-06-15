import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Calendar as CalIcon, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";

export default function CalendarView() {
  const [tasks, setTasks] = useState([]);
  const [date, setDate] = useState(new Date());

  const load = async () => {
    const { data } = await api.get("/tasks");
    setTasks(data);
  };
  useEffect(() => { load(); }, []);

  const taskDates = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (t.date) {
        const key = t.date;
        map[key] = map[key] || [];
        map[key].push(t);
      }
    }
    return map;
  }, [tasks]);

  const selectedKey = date ? date.toISOString().slice(0, 10) : "";
  const tasksForDay = taskDates[selectedKey] || [];

  const toggle = async (t) => {
    await api.put(`/tasks/${t.id}`, { completed: !t.completed });
    load();
  };

  const datesWithTasks = Object.keys(taskDates).map((d) => new Date(d + "T00:00:00"));

  const addQuick = async () => {
    const desc = prompt("Task description?");
    if (!desc) return;
    await api.post("/tasks", { desc, date: selectedKey });
    toast.success("Task added");
    load();
  };

  return (
    <div data-testid="calendar-section">
      <div className="head-row">
        <div>
          <h1>Calendar</h1>
          <div className="sub">Visualize your deadlines and tap a day to drill in.</div>
        </div>
        <button className="btn" onClick={addQuick} data-testid="cal-add-btn"><Plus size={15} /> Add task on {selectedKey}</button>
      </div>

      <div className="cal-wrap">
        <div className="card cal-card">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            modifiers={{ hasTasks: datesWithTasks }}
            modifiersStyles={{
              hasTasks: { background: "var(--grad-soft)", borderRadius: 6, fontWeight: 700 },
            }}
            className="rounded-md"
          />
          <small style={{ color: "var(--text-muted)", display: "block", marginTop: 12 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "var(--grad)", marginRight: 6 }} />
            Highlighted dates have tasks
          </small>
        </div>

        <div className="card cal-card">
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 14 }}>
            <CalIcon size={16} style={{ verticalAlign: "middle", marginRight: 6, color: "var(--primary)" }} />
            {date ? date.toDateString() : "Select a date"}
          </h3>
          {tasksForDay.length === 0 ? (
            <div className="empty">No tasks for this day.</div>
          ) : (
            tasksForDay.map((t) => (
              <div className="cal-day" key={t.id}>
                <div
                  className={`check ${t.completed ? "on" : ""}`}
                  onClick={() => toggle(t)}
                  data-testid={`cal-check-${t.id}`}
                >
                  {t.completed && <Check size={12} />}
                </div>
                <div style={{ textDecoration: t.completed ? "line-through" : "none", color: t.completed ? "var(--text-muted)" : "var(--text)" }}>
                  {t.desc}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
