import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const startGoogleAuth = () => {
  const redirectUrl = window.location.origin + "/";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.4 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.3C29.3 35 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8L6 32.8C9.2 39.4 16 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.3C40.9 35.4 44 30.1 44 24c0-1.3-.1-2.4-.4-3.5z"/>
  </svg>
);

export default function AuthScreen({ initialMode = "login", onBack }) {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(initialMode === "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !name)) return toast.error("Please fill all fields");
    setLoading(true);
    try {
      if (isLogin) { await login(email, password); toast.success("Welcome back!"); }
      else { await register(name, email, password); toast.success("Account created!"); }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen" data-testid="auth-screen">
      <div className="auth-card">
        {onBack && (
          <button className="auth-back" onClick={onBack} data-testid="auth-back-btn">
            <ArrowLeft size={14} /> Back
          </button>
        )}
        <h1>{isLogin ? "Welcome back" : "Create account"}</h1>
        <p className="lead">{isLogin ? "Sign in to continue your study streak." : "30 seconds to focus mode."}</p>

        <button
          type="button"
          className="btn-google"
          onClick={startGoogleAuth}
          data-testid="google-auth-btn"
        >
          <GoogleIcon /> Continue with Google
        </button>

        <div className="divider"><span>or use email</span></div>

        <form onSubmit={submit}>
          {!isLogin && (
            <div className="field">
              <label>Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" data-testid="auth-name-input" />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" data-testid="auth-email-input" />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" data-testid="auth-password-input" />
          </div>
          <button type="submit" className="btn" style={{ width: "100%", padding: "13px", fontSize: "0.98rem" }} disabled={loading} data-testid="auth-submit-btn">
            {loading ? "Please wait…" : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>
        <button className="toggle-link" onClick={() => setIsLogin(!isLogin)} data-testid="auth-toggle-link">
          {isLogin ? "Need an account? Sign Up" : "Have an account? Sign In"}
        </button>
        
      </div>
    </div>
  );
}
