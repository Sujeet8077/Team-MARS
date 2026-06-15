import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Crown, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PremiumModal({ onClose }) {
  const { user, refreshUser } = useAuth();
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/payments/config").then((r) => setCfg(r.data)).catch(() => {});
  }, []);

  // Currently: free instant unlock. Razorpay flow is wired & will activate
  // automatically once real keys are added in backend/.env.
  const unlock = async () => {
    setLoading(true);
    try {
      await api.post("/payments/free-upgrade");
      toast.success("🎉 Premium unlocked!", {
        description: "Enjoy unlimited AI, 500MB storage, and all themes.",
      });
      await refreshUser();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not unlock premium");
    } finally {
      setLoading(false);
    }
  };

  if (user?.is_premium) {
    return (
      <div className="modal-wrap" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <button className="close-x" onClick={onClose}><X size={18} /></button>
          <div className="upgrade-hero">
            <div className="crown"><Crown size={28} /></div>
            <h2>You're Premium! 👑</h2>
            <p style={{ color: "var(--text-muted)" }}>Enjoy unlimited AI, 500MB storage, and all themes.</p>
          </div>
          <button className="btn" style={{ width: "100%" }} onClick={onClose}>Awesome</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-wrap" onClick={onClose} data-testid="premium-modal">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-x" onClick={onClose}><X size={18} /></button>

        <div className="upgrade-hero">
          <div className="crown"><Crown size={28} /></div>
          <h2>Unlock Premium</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.92rem" }}>
            Launch promo · Free instant unlock
          </p>
          <div className="price">
            <span style={{ textDecoration: "line-through", opacity: 0.4, fontSize: "1.6rem", marginRight: 10, color: "var(--text-muted)", WebkitTextFillColor: "var(--text-muted)" }}>₹99</span>
            ₹0 <small>limited time</small>
          </div>
        </div>

        <ul className="upgrade-list">
          <li><Check size={16} /> <strong>500MB</strong> cloud storage (vs 25MB free)</li>
          <li><Check size={16} /> <strong>Unlimited</strong> AI Tutor messages</li>
          <li><Check size={16} /> Priority <strong>Gemini 2.5 Pro</strong> model</li>
          <li><Check size={16} /> Ad-free experience</li>
          <li><Check size={16} /> All 5 themes unlocked</li>
          <li><Check size={16} /> Early access to new features</li>
        </ul>

        <button
          className="btn"
          style={{ width: "100%", padding: "13px" }}
          onClick={unlock}
          disabled={loading}
          data-testid="pay-now-btn"
        >
          {loading
            ? <><Loader2 size={15} className="spin" /> Unlocking…</>
            : <><Crown size={15} /> Unlock Premium — Free</>}
        </button>

        <small style={{ display: "block", marginTop: 14, color: "var(--text-muted)", textAlign: "center", fontSize: "0.78rem" }}>
          🎁 Launch offer — payment integration coming soon. Razorpay UPI/cards will activate when keys are added in backend/.env.
        </small>
      </div>
    </div>
  );
}
