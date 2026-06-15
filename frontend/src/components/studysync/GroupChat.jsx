import { useEffect, useRef, useState } from "react";
import api, { API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { X, Send } from "lucide-react";

export default function GroupChat({ group, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const wsRef = useRef(null);
  const scrollRef = useRef(null);

  const scroll = () => setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);

  useEffect(() => {
    // Load history
    api.get(`/groups/${group.id}/messages`).then((r) => { setMessages(r.data); scroll(); }).catch(() => {});

    // Open WebSocket
    const token = localStorage.getItem("ss_token");
    const wsBase = API.replace(/^http/, "ws").replace(/\/api$/, "");
    const ws = new WebSocket(`${wsBase}/api/ws/groups/${group.id}?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        setMessages((m) => [...m, msg]);
        scroll();
      } catch {}
    };
    ws.onerror = () => {};
    return () => ws.close();
    // eslint-disable-next-line
  }, [group.id]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text }));
    } else {
      // Fallback to REST
      api.post(`/groups/${group.id}/messages`, { text }).then((r) => {
        setMessages((m) => [...m, r.data]); scroll();
      });
    }
    setInput("");
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="modal-wrap" onClick={onClose} data-testid="group-chat-modal">
      <div className="modal" style={{ maxWidth: 580, padding: 0, height: "75vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="gchat-head">
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>{group.name}</h3>
            <small style={{ color: "var(--text-muted)" }}>Host: {group.host} · {group.members} members</small>
          </div>
          <button className="ico-btn" onClick={onClose} data-testid="gchat-close"><X size={16} /></button>
        </div>
        <div className="gchat-msgs" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="empty">No messages yet. Say hi 👋</div>
          ) : messages.map((m) => (
            <div key={m.id} className={`gmsg ${m.user_id === user?.id ? "mine" : "theirs"}`}>
              {m.user_id !== user?.id && <span className="who">{m.user_name}</span>}
              {m.text}
            </div>
          ))}
        </div>
        <div className="chat-input-row" style={{ background: "var(--bg-2)" }}>
          <input
            placeholder="Type a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            data-testid="gchat-input"
          />
          <button className="chat-send" onClick={send} data-testid="gchat-send"><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}
