import { useEffect, useState, useRef } from "react";
import api, { API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash2, ExternalLink, Upload, Cloud, X, Crown } from "lucide-react";
import { toast } from "sonner";

const fmtMB = (b) => (b / 1024 / 1024).toFixed(1);

export default function Resources({ onUpgrade }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [resources, setResources] = useState([]);
  const [usage, setUsage] = useState({ used_bytes: 0, limit_bytes: 25 * 1024 * 1024, is_premium: false });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("link");
  const [link, setLink] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const [r, u] = await Promise.all([api.get("/resources"), api.get("/storage/usage")]);
    setResources(r.data);
    setUsage(u.data);
  };
  useEffect(() => { load(); }, []);

  const reset = () => { 
    setTitle(""); 
    setLink(""); 
    setFile(null); 
    setType("link"); 
    if (fileInputRef.current) fileInputRef.current.value = "";
    setOpen(false); 
  };

  const submit = async () => {
    if (!title.trim()) return toast.error("Title required");
    if (type === "link") {
      if (!link.trim()) return toast.error("Link required");
      await api.post("/resources", { title: title.trim(), type: "link", link: link.trim() });
      toast.success("Link added");
      reset(); load();
      return;
    }
    if (!file) return toast.error("Select a file");
    try {
      setUploading(true);
      const form = new FormData();
      form.append("file", file);
      const token = localStorage.getItem("ss_token");
      const res = await fetch(`${API}/files/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 402) {
          toast.error(err.detail || "Storage quota exceeded");
          onUpgrade && onUpgrade();
          return;
        }
        throw new Error(err.detail || "Upload failed");
      }
      const data = await res.json();
      const downloadUrl = `${API}/files/${data.storage_path}?auth=${token}`;
      await api.post("/resources", {
        title: title.trim(),
        type,
        link: downloadUrl,
        storage_path: data.storage_path,
        size: data.size,
      });
      toast.success("Uploaded ☁️");
      reset(); load();
    } catch (e) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const del = async (id) => {
    await api.delete(`/resources/${id}`);
    toast.success("Removed"); load();
  };

  const openLink = (r) => window.open(r.link, "_blank");

  const usagePct = usage.limit_bytes ? Math.min(100, (usage.used_bytes / usage.limit_bytes) * 100) : 0;

  return (
    <div data-testid="resources-section">
      <div className="head-row">
        <div>
          <h1>Resources</h1>
          <div className="sub">Links, PDFs, images — your study locker.</div>
        </div>
        <button className="btn" onClick={() => setOpen(true)} data-testid="add-resource-btn"><Plus size={15} /> Add Resource</button>
      </div>

      {/* Storage usage bar */}
      <div className="card" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Cloud size={22} style={{ color: "var(--primary)" }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.88rem" }}>
            <span><strong>{fmtMB(usage.used_bytes)} MB</strong> used of {fmtMB(usage.limit_bytes)} MB</span>
            <span style={{ color: "var(--text-muted)" }}>{usage.is_premium ? "Premium" : "Free"} tier</span>
          </div>
          <div className="bar" style={{ height: 8, background: "var(--surface-2)", borderRadius: 5, overflow: "hidden" }}>
            <div style={{ width: `${usagePct}%`, height: "100%", background: usagePct > 85 ? "var(--danger)" : "var(--grad)", transition: "width 0.3s" }} />
          </div>
        </div>
        {!usage.is_premium && (
          <button className="btn" onClick={onUpgrade}><Crown size={13} /> Upgrade to 500MB</button>
        )}
      </div>

      {resources.length === 0 ? (
        <div className="empty">No resources yet. Add a link or upload a file →</div>
      ) : (
        <div className="res-grid">
          {resources.map((r) => (
            <div key={r.id} className="res-card" data-testid={`resource-${r.id}`}>
              <button className="del-btn" onClick={() => del(r.id)}><Trash2 size={15} /></button>
              <h4>{r.title}</h4>
              <small>{r.type}{r.size ? ` · ${fmtMB(r.size)} MB` : ""}</small>
              <br />
              <button className="btn secondary" style={{ marginTop: 12, padding: "7px 14px" }} onClick={() => openLink(r)}>
                <ExternalLink size={13} /> Open
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="modal-wrap" onClick={reset}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-x" onClick={reset}><X size={18} /></button>
            <h2>Add Resource</h2>
            <div className="field">
              <label>Title</label>
              <input placeholder="e.g. Physics Ch. 5 Notes" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="res-title-input" autoFocus />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={type} onChange={(e) => { setType(e.target.value); setLink(""); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} data-testid="res-type-select">
                <option value="link">Web Link</option>
                <option value="pdf">PDF Upload</option>
                <option value="image">Image Upload</option>
                <option value="file">Other File</option>
              </select>
            </div>
            {type === "link" ? (
              <div className="field" key="link-field">
                <label>URL</label>
                <input key="link-input" placeholder="https://..." value={link} onChange={(e) => setLink(e.target.value)} data-testid="res-link-input" />
              </div>
            ) : (
              <div className="field" key="file-field">
                <label>File (max 50MB)</label>
                <input key="file-input" ref={fileInputRef} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} data-testid="res-file-input" />
              </div>
            )}
            <button className="btn" style={{ width: "100%" }} onClick={submit} disabled={uploading} data-testid="res-save-btn">
              {uploading ? "Uploading…" : <><Upload size={14} /> Save Resource</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
