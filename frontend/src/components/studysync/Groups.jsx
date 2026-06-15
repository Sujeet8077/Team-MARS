import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Plus, LogIn, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Groups({ onOpenChat }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");

  const load = async () => {
    const { data } = await api.get("/groups");
    setGroups(data);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return toast.error("Room name required");
    await api.post("/groups", { name: name.trim() });
    toast.success("Room created");
    setName(""); setShowCreate(false); load();
  };

  const join = async (g) => {
    await api.post(`/groups/${g.id}/join`);
    toast.success(`Joined ${g.name}`);
    load();
  };

  const del = async (g) => {
    if (!window.confirm(`Delete room "${g.name}"?`)) return;
    try {
      await api.delete(`/groups/${g.id}`);
      toast.success("Room deleted");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Cannot delete");
    }
  };

  return (
    <div data-testid="groups-section">
      <div className="head-row">
        <div>
          <h1>Study Rooms</h1>
          <div className="sub">Create rooms, chat in real time, study together.</div>
        </div>
        <button className="btn" onClick={() => setShowCreate(true)} data-testid="create-group-btn"><Plus size={15} /> Create Room</button>
      </div>

      {groups.length === 0 ? (
        <div className="empty">No rooms yet. Be the first to create one!</div>
      ) : (
        <div className="group-grid">
          {groups.map((g) => {
            const joined = g.user_ids?.includes(user?.id);
            const canDelete = g.host_id === user?.id || user?.role === "admin";
            return (
              <div className="group-card" key={g.id} data-testid={`group-${g.id}`}>
                <div>
                  <h4>{g.name}</h4>
                  <small>Host: {g.host} · {g.members} members</small>
                </div>
                <div className="actions">
                  {joined ? (
                    <button className="btn" onClick={() => onOpenChat(g)} data-testid={`chat-btn-${g.id}`}>
                      <MessageCircle size={14} /> Open Chat
                    </button>
                  ) : (
                    <button className="btn" onClick={() => join(g)} data-testid={`join-btn-${g.id}`}>
                      <LogIn size={14} /> Join
                    </button>
                  )}
                  {canDelete && (
                    <button className="btn secondary" onClick={() => del(g)} data-testid={`del-group-${g.id}`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="modal-wrap" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Study Room</h2>
            <div className="field">
              <label>Room name</label>
              <input placeholder="e.g. JEE Maths Marathon" value={name} onChange={(e) => setName(e.target.value)} autoFocus data-testid="room-name-input" />
            </div>
            <button className="btn" style={{ width: "100%" }} onClick={create} data-testid="room-create-btn">Create</button>
          </div>
        </div>
      )}
    </div>
  );
}
