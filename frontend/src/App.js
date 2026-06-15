import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";
import LandingPage from "@/pages/LandingPage";
import AuthScreen from "@/pages/AuthScreen";
import StudySync from "@/pages/StudySync";
import AuthCallback from "@/pages/AuthCallback";
import { useEffect, useState } from "react";

const Gate = () => {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  // Detect Google OAuth callback synchronously
  const hasCallback = typeof window !== "undefined" && window.location.hash?.includes("session_id=");

  useEffect(() => {
    document.body.classList.add("studysync-body");
  }, []);

  if (hasCallback) {
    return <AuthCallback />;
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--text-muted)", background: "var(--bg)" }}>
        Loading…
      </div>
    );
  }
  if (user) return <StudySync />;
  if (showAuth) {
    return (
      <AuthScreen
        initialMode={authMode}
        onBack={() => setShowAuth(false)}
      />
    );
  }
  return (
    <LandingPage
      onLogin={() => { setAuthMode("login"); setShowAuth(true); }}
      onSignup={() => { setAuthMode("signup"); setShowAuth(true); }}
    />
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors theme="dark" />
        <Routes>
          <Route path="/" element={<Gate />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
