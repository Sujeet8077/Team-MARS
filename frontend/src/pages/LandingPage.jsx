import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  GraduationCap, Sparkles, BookOpenCheck, Timer, Bot, Users,
  Calendar, Check, ArrowRight, Cloud, Crown, Zap, Star, Menu, X,
} from "lucide-react";

const fmtNum = (n) => {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K";
  return n.toString();
};

export default function LandingPage({ onLogin, onSignup }) {
  const [stats, setStats] = useState({ users: 0, pomodoros: 0, tasks_completed: 0 });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api.get("/public/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const close = (cb) => () => { setMenuOpen(false); cb && cb(); };

  return (
    <div className="land-wrap" data-testid="landing-page">
      <nav className="land-nav">
        <div className="land-logo">
          <div className="dot"><GraduationCap size={18} /></div>
          <span>StudySync</span>
        </div>
        <div className="nav-links desktop-only">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#stories">Stories</a>
          <button className="btn-ghost" onClick={onLogin} data-testid="nav-signin-btn">Sign In</button>
          <button className="btn-grad" onClick={onSignup} data-testid="nav-signup-btn">
            Get Started <ArrowRight size={15} />
          </button>
        </div>
        <button className="hamburger mobile-only" onClick={() => setMenuOpen(!menuOpen)} aria-label="menu">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {menuOpen && (
        <div className="mobile-menu">
          <a href="#features" onClick={close()}>Features</a>
          <a href="#pricing" onClick={close()}>Pricing</a>
          <a href="#stories" onClick={close()}>Stories</a>
          <button className="btn-ghost" onClick={close(onLogin)}>Sign In</button>
          <button className="btn-grad" onClick={close(onSignup)}>Get Started <ArrowRight size={15} /></button>
        </div>
      )}

      <section className="land-hero">
        <span className="pill">
          <Sparkles size={14} color="var(--primary)" /> AI-powered study companion · Built for serious learners
        </span>
        <h1>
          Your study workspace,<br />
          <span className="grad">finally beautiful.</span>
        </h1>
        <p className="sub">
          One place for tasks, focus timers, notes, study rooms, and an AI tutor that actually helps.
          StudySync turns "I should study" into "I'm in the zone."
        </p>
        <div className="land-cta-row">
          <button className="btn-grad" onClick={onSignup} data-testid="hero-cta-btn">
            Start free <ArrowRight size={16} />
          </button>
          <button className="btn-ghost" onClick={onLogin}>Sign in</button>
        </div>
        <div className="land-stats">
          <div><strong data-testid="stat-users">{fmtNum(stats.users)}</strong> learners on board</div>
          <div><strong data-testid="stat-pomos">{fmtNum(stats.pomodoros)}</strong> pomodoros logged</div>
          <div><strong data-testid="stat-tasks">{fmtNum(stats.tasks_completed)}</strong> tasks completed</div>
        </div>

        <div className="land-preview">
          <div className="land-preview-frame">
            <div className="topbar"><i/><i/><i/></div>
            <div className="preview-body">
              <div className="fake-grid">
                <div className="fake-card">
                  <small style={{ color: "var(--text-muted)" }}>Daily Goal</small>
                  <h3 style={{ margin: "8px 0 12px", fontSize: "1.3rem" }}>4h focus</h3>
                  <div className="fake-progress"><div /></div>
                  <small style={{ color: "var(--text-muted)", display: "block", marginTop: 8 }}>2h 38m studied today</small>
                </div>
                <div className="fake-card">
                  <small style={{ color: "var(--text-muted)" }}>Today's Tasks</small>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, background: "var(--success)" }} />
                    <div className="fake-bar long" />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, border: "2px solid var(--border-strong)" }} />
                    <div className="fake-bar short" />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, border: "2px solid var(--border-strong)" }} />
                    <div className="fake-bar long" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="land-section">
        <h2>Everything you need to focus.</h2>
        <p className="lead">Built from first principles for students who actually want to get things done.</p>
        <div className="feature-grid">
          {[
            { ico: Timer, title: "Auto-start Study Timer", desc: "Opens the app, starts the clock. No friction. Daily goal tracked in real time with a beautiful progress bar." },
            { ico: BookOpenCheck, title: "Smart Task Manager", desc: "Plan with calendar view, check off as you go, watch your completion ring fill up." },
            { ico: Bot, title: "AI Tutor (Gemini-powered)", desc: "Ask anything — get step-by-step explanations, examples, and study plans. Premium gets priority Gemini Pro." },
            { ico: Zap, title: "Pomodoro + Achievements", desc: "Lock in for 25-min sprints. Earn milestones at 5, 10, 25, 50, 100 sessions." },
            { ico: Users, title: "Live Study Rooms", desc: "Create rooms, chat in real time over WebSocket, study with friends across the globe." },
            { ico: Cloud, title: "Cloud-backed Notes", desc: "PDFs, images, links — uploaded to secure object storage. Premium gets 500MB." },
            { ico: Calendar, title: "Calendar View", desc: "See every deadline at a glance. Plan tomorrow tonight, knock it out in the morning." },
            { ico: Sparkles, title: "5 Stunning Themes", desc: "Dark, Light, Ocean, Forest, Sunset. Switch in one click — your vibe, your way." },
          ].map((f, i) => (
            <div key={i} className="feat-card">
              <div className="ico"><f.ico size={22} /></div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="land-section">
        <h2>Simple, honest pricing.</h2>
        <p className="lead">Everything works on the free plan. Premium just removes limits and gives priority access.</p>
        <div className="pricing-grid">
          <div className="price-card">
            <h3>Free</h3>
            <small style={{ color: "var(--text-muted)" }}>Forever — no credit card</small>
            <div className="price">₹0 <small>/month</small></div>
            <ul>
              <li><Check size={16} /> All core features unlocked</li>
              <li><Check size={16} /> Up to 25MB storage</li>
              <li><Check size={16} /> 15 AI tutor messages / day</li>
              <li><Check size={16} /> Standard AI model (Gemini Flash)</li>
              <li><Check size={16} /> 2 themes (Dark, Light)</li>
            </ul>
            <button className="btn-ghost" onClick={onSignup} style={{ width: "100%" }} data-testid="free-cta-btn">
              Start free
            </button>
          </div>

          <div className="price-card featured">
            <span className="badge">MOST POPULAR</span>
            <h3><Crown size={18} style={{ verticalAlign: "middle", marginRight: 6, color: "var(--warning)" }} /> Premium</h3>
            <small style={{ color: "var(--text-muted)" }}>One-time payment · lifetime access</small>
            <div className="price">₹99 <small>once</small></div>
            <ul>
              <li><Check size={16} /> Everything in Free</li>
              <li><Check size={16} /> <strong>500MB</strong> cloud storage</li>
              <li><Check size={16} /> <strong>Unlimited</strong> AI tutoring</li>
              <li><Check size={16} /> Priority AI (Gemini 2.5 Pro)</li>
              <li><Check size={16} /> Ad-free experience</li>
              <li><Check size={16} /> All 5 themes unlocked</li>
              <li><Check size={16} /> Early access to new features</li>
            </ul>
            <button className="btn-grad" onClick={onSignup} style={{ width: "100%" }} data-testid="premium-cta-btn">
              Get Premium <Crown size={15} />
            </button>
          </div>
        </div>
      </section>

      <section id="stories" className="land-section">
        <h2>Loved by learners everywhere.</h2>
        <p className="lead">Real students, real results.</p>
        <div className="test-grid">
          {[
            { name: "Sujeet Singh", role: "React Front-end Developer", text: "The Pomodoro + AI tutor combo got me through tough React concepts. I track 6 hrs daily without burnout.", i: "S" },
            { name: "Mukul Arya", role: "Front-end Developer", text: "Achievement notifications make studying weirdly addictive. Hit 100 pomodoros last month — felt unreal.", i: "M" },
            { name: "Adarsh Raj Pandey", role: "Front-end Developer", text: "I love the dark theme and live study rooms. Studying with friends across cities feels like a hostel room.", i: "A" },
            { name: "Rahul Bhatt", role: "Backend Developer", text: "Best ₹99 I ever spent. Unlimited AI + 500MB makes this my single study app. Worth every rupee.", i: "R" },
          ].map((t, i) => (
            <div key={i} className="glass test-card">
              <p>"{t.text}"</p>
              <div className="who">
                <div className="ava">{t.i}</div>
                <div>
                  <strong>{t.name}</strong>
                  <small>{t.role}</small>
                </div>
              </div>
              <div style={{ display: "flex", gap: 2, marginTop: 10 }}>
                {[...Array(5)].map((_, j) => <Star key={j} size={14} fill="var(--warning)" color="var(--warning)" />)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="land-section" style={{ paddingBottom: 60 }}>
        <div className="glass" style={{ maxWidth: 800, margin: "0 auto", padding: 50, textAlign: "center" }}>
          <h2 style={{ fontSize: "2.2rem", marginBottom: 14 }}>Ready to lock in?</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 26 }}>Join the focused learners. Start in 30 seconds.</p>
          <button className="btn-grad" onClick={onSignup} style={{ padding: "14px 28px", fontSize: "1.05rem" }} data-testid="final-cta-btn">
            Get Started Free <ArrowRight size={17} />
          </button>
        </div>
      </section>

      <footer className="land-foot">
        © 2026 · Developed by <strong>Team MARS</strong> · StudySync
      </footer>
    </div>
  );
}
