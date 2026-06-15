import { useEffect, useRef, useState } from "react";
import { Send, Trash2, Bot, Crown, Sparkles } from "lucide-react";
import api, { API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Explain photosynthesis in simple terms",
  "Help me memorize the periodic table",
  "Quiz me on JavaScript closures",
  "Make a study plan for tomorrow",
];

export default function AITutor({ onUpgrade }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState({ used_today: 0, limit: 15, is_premium: false });
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef(null);

  const scroll = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
  };

  const refreshUsage = () => api.get("/ai/usage").then((r) => setUsage(r.data)).catch(() => {});

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/ai/history");
        if (data.length > 0) setMessages(data.map((m) => ({ role: m.role, text: m.text })));
      } catch {}
      finally { setLoadingHistory(false); }
    })();
    refreshUsage();
  }, []);

  useEffect(() => { scroll(); }, [messages]);

  const doSend = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: msg }, { role: "assistant", text: "", thinking: true }]);
    setStreaming(true);
    try {
      const token = localStorage.getItem("ss_token");
      const res = await fetch(`${API}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg }),
      });
      if (res.status === 402) {
        setMessages((m) => m.slice(0, -2));
        toast.error("Daily AI limit reached (15/day for free users)", { description: "Upgrade to Premium for unlimited tutoring." });
        onUpgrade && onUpgrade();
        return;
      }
      if (res.status === 401) {
        setMessages((m) => m.slice(0, -2));
        toast.error("Session expired — please sign in again");
        return;
      }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let got = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const ev of events) {
          const dataLines = ev.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6));
          if (dataLines.length === 0) continue;
          const payload = dataLines.join("\n");
          let parsed;
          try { parsed = JSON.parse(payload); } catch { continue; }
          if (parsed.type === "delta" && parsed.content) {
            got = true;
            setMessages((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") {
                next[next.length - 1] = { ...last, text: last.text + parsed.content, thinking: false };
              }
              return next;
            });
          } else if (parsed.type === "error") {
            toast.error("AI: " + (parsed.message || "error"));
          } else if (parsed.type === "done") {
            break;
          }
        }
      }
      if (!got) {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last && last.role === "assistant" && !last.text) {
            next[next.length - 1] = { ...last, text: "Hmm — I didn't get a response. Try sending your question again.", thinking: false };
          }
          return next;
        });
      }
      refreshUsage();
    } catch (e) {
      setMessages((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.role === "assistant" && !last.text) {
          next[next.length - 1] = { ...last, text: `Connection error: ${e.message}. Check your internet & retry.`, thinking: false };
        }
        return next;
      });
      toast.error("Network error — please retry");
    } finally {
      setStreaming(false);
    }
  };

  const clear = async () => {
    if (!window.confirm("Clear chat history?")) return;
    await api.delete("/ai/history");
    setMessages([]);
    toast.success("Cleared");
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
  };

  const remaining = usage.is_premium ? "∞" : Math.max(0, usage.limit - usage.used_today);
  const isEmpty = !loadingHistory && messages.length === 0;

  return (
    <div data-testid="tutor-section">
      <div className="head-row">
        <div>
          <h1><Bot size={26} style={{ verticalAlign: "middle", marginRight: 8, color: "var(--primary)" }} /> AI Tutor</h1>
          <div className="sub">
            Powered by Gemini · {usage.is_premium ? "Premium · Unlimited" : `${remaining} of ${usage.limit} messages left today`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {!usage.is_premium && (
            <button className="btn" onClick={onUpgrade}><Crown size={13} /> Go Unlimited</button>
          )}
          {messages.length > 0 && (
            <button className="btn secondary" onClick={clear} data-testid="clear-chat-btn"><Trash2 size={14} /> Clear</button>
          )}
        </div>
      </div>

      <div className="chat-wrap">
        <div className="chat-box" ref={scrollRef} data-testid="chat-box">
          {isEmpty ? (
            <div className="ai-welcome">
              <div className="ai-orb"><Bot size={32} /></div>
              <h3>Hi {user?.name?.split(" ")[0] || "there"}! I'm your AI Tutor.</h3>
              <p>Ask me anything — explanations, study plans, quick quizzes, code reviews. Try one of these:</p>
              <div className="ai-suggest-grid">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="ai-suggest" onClick={() => doSend(s)} disabled={streaming} data-testid={`suggest-${s.slice(0, 10)}`}>
                    <Sparkles size={13} /> {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`msg ${m.role === "user" ? "user" : "bot"}`}>
                {m.thinking && !m.text ? (
                  <span className="typing">
                    <span></span><span></span><span></span>
                  </span>
                ) : (m.text || "...")}
              </div>
            ))
          )}
        </div>
        <div className="chat-input-row">
          <input
            placeholder={streaming ? "Thinking…" : "Ask anything (e.g. Explain photosynthesis)"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={streaming}
            data-testid="chat-input"
          />
          <button
            className="chat-send"
            onClick={() => doSend()}
            disabled={streaming || !input.trim()}
            data-testid="chat-send-btn"
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
