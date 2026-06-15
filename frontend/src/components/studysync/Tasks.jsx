import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");

  const load = async () => {
    const { data } = await api.get("/tasks");
    setTasks(data);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!desc.trim()) return toast.error("Description required");
    await api.post("/tasks", { desc: desc.trim(), date });
    setDesc(""); setDate(""); setOpen(false);
    toast.success("Task added");
    load();
  };

  const toggle = async (t) => {
    await api.put(`/tasks/${t.id}`, { completed: !t.completed });
    load();
  };

  const del = async (id) => {
    await api.delete(`/tasks/${id}`);
    toast.success("Task removed");
    load();
  };

  return (
    <div data-testid="tasks-section">
      <div className="head-row">
        <div>
          <h1>Your Tasks</h1>
          <div className="sub">Plan, prioritise, conquer.</div>
        </div>
        <button className="btn" onClick={() => setOpen(true)} data-testid="add-task-btn"><Plus size={15} /> New Task</button>
      </div>

      {tasks.length === 0 ? (
        <div className="empty">No tasks yet. Add your first one above.</div>
      ) : tasks.map((t) => (
        <div key={t.id} className={`task-row ${t.completed ? "done" : ""}`} data-testid={`task-item-${t.id}`}>
          <div className="task-left">
            <div className={`check ${t.completed ? "on" : ""}`} onClick={() => toggle(t)} data-testid={`task-check-${t.id}`}>
              {t.completed && <Check size={13} />}
            </div>
            <div>
              <h4>{t.desc}</h4>
              {t.date && <small>Due: {t.date}</small>}
            </div>
          </div>
          <button className="del-btn" onClick={() => del(t.id)} data-testid={`task-del-${t.id}`}><Trash2 size={17} /></button>
        </div>
      ))}

      {open && (
        <div className="modal-wrap" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-x" onClick={() => setOpen(false)}><X size={18} /></button>
            <h2>New Task</h2>
            <div className="field">
              <label>Description</label>
              <input placeholder="What needs doing?" value={desc} onChange={(e) => setDesc(e.target.value)} data-testid="task-desc-input" autoFocus />
            </div>
            <div className="field">
              <label>Due date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="task-date-input" />
            </div>
            <button className="btn" style={{ width: "100%" }} onClick={add} data-testid="task-save-btn">Save Task</button>
          </div>
        </div>
      )}
    </div>
  );
}
