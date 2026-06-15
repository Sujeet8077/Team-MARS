import { useState } from "react";
import { Video, LogIn } from "lucide-react";

export default function GMeet() {
  const [code, setCode] = useState("");
  const start = () => window.open("https://meet.google.com/new", "_blank");
  const join = () => window.open(`https://meet.google.com/${code.trim()}`, "_blank");

  return (
    <div data-testid="meet-section">
      <div className="head-row">
        <div>
          <h1>Live Meet</h1>
          <div className="sub">Instant video meetings via Google Meet.</div>
        </div>
      </div>
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: "0 0 6px", fontSize: "1.15rem", fontWeight: 700 }}>
            <Video size={18} style={{ verticalAlign: "middle", marginRight: 8, color: "var(--primary)" }} />
            Google Meet
          </h3>
          <small style={{ color: "var(--text-muted)" }}>Start a new conference or join with a code.</small>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn" onClick={start} data-testid="meet-start-btn"><Video size={14} /> New Meeting</button>
          <input
            placeholder="abc-defg-hij"
            value={code} onChange={(e) => setCode(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "inherit" }}
            data-testid="meet-code-input"
          />
          <button className="btn secondary" onClick={join} data-testid="meet-join-btn">
            <LogIn size={13} /> Join
          </button>
        </div>
      </div>
    </div>
  );
}
