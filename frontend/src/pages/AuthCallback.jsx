import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback({ onDone }) {
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    (async () => {
      try {
        const hash = window.location.hash || "";
        const m = hash.match(/session_id=([^&]+)/);
        if (!m) {
          onDone && onDone();
          return;
        }
        const session_id = m[1];
        const { data } = await api.post("/auth/google", { session_id });
        localStorage.setItem("ss_token", data.token);
        setUser(data.user);
        document.documentElement.setAttribute("data-theme", data.user.theme || "dark");
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
        toast.success(`Welcome, ${data.user.name?.split(" ")[0] || "friend"}!`);
        onDone && onDone();
      } catch (e) {
        toast.error("Google sign-in failed");
        window.history.replaceState({}, "", window.location.pathname);
        onDone && onDone();
      }
    })();
    // eslint-disable-next-line
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ textAlign: "center" }}>
        <div className="auth-card" style={{ minWidth: 320 }}>
          <h1>Signing you in…</h1>
          <p className="lead">Just a moment.</p>
          <div className="loader-bar"><div /></div>
        </div>
      </div>
    </div>
  );
}
