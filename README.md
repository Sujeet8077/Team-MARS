# StudySync — Full-Stack Study Workspace

> Personal, all-in-one study companion. Tasks, resources, study timer, group rooms, AI tutor and 5 beautiful themes.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | **React 19** + Tailwind + shadcn/ui + Sonner |
| Backend  | **FastAPI** (Python) — REST + SSE streaming |
| Database | **MongoDB** (Motor async driver) |
| AI       | **Gemini 2.5 Flash** via Emergent Universal LLM Key |
| Auth     | JWT (bcrypt password hashing) |

> ℹ️ The frontend + DB are pure **MERN-compatible**. The backend is FastAPI instead of Express/Node — the architecture is identical (REST + JWT). See "Convert to MERN" below if you want pure Node.

## Features

- 🔐 **Auth** — register / login / JWT, with a pre-seeded **admin** account
- 📊 **Dashboard** — circular completion chart, stat cards, recent widgets
- ⏱ **Study Timer & Daily Goal** — running timer, progress bar, persistent server-side tracking
- ✅ **Tasks** — full CRUD with due dates, check-off, deletion
- 📚 **Resources** — links / PDFs / images / files (base64 store, ≤ 3MB)
- 👥 **Study Groups** — create rooms, join existing rooms
- 📹 **Live Meet** — instant Google Meet shortcuts
- 🤖 **AI Tutor** — streaming Gemini chat with full history per user
- 🎨 **5 Themes** — Light · Dark · Ocean Blue · Forest Green · Sunset Warm
- 👑 **Admin role** — admin can delete any group

## Project Structure

```
/app
├── backend/
│   ├── server.py            # FastAPI app — all endpoints
│   ├── requirements.txt
│   └── .env                 # MONGO_URL, DB_NAME, JWT_SECRET, ADMIN_*, EMERGENT_LLM_KEY
└── frontend/
    ├── package.json
    ├── public/index.html
    └── src/
        ├── App.js
        ├── App.css          # 5-theme system + all StudySync styles
        ├── lib/api.js       # axios instance w/ JWT interceptor
        ├── context/AuthContext.jsx
        ├── pages/
        │   ├── AuthScreen.jsx
        │   └── StudySync.jsx
        └── components/studysync/
            ├── Sidebar.jsx
            ├── Dashboard.jsx
            ├── Tasks.jsx
            ├── Resources.jsx
            ├── Groups.jsx
            ├── GMeet.jsx
            ├── AITutor.jsx
            └── Settings.jsx
```

## Admin Credentials (seeded on first run)

```
Email:    admin@studysync.com
Password: Admin@123
```

Change these in `backend/.env` before first launch.

## Step-by-Step Local Setup

### 1. Prerequisites
- Node.js ≥ 18 + Yarn
- Python 3.10+
- MongoDB running locally on `mongodb://localhost:27017` (or set `MONGO_URL`)

### 2. Backend
```bash
cd backend
pip install -r requirements.txt
# Edit .env if you want to change ADMIN_EMAIL / ADMIN_PASSWORD / JWT_SECRET
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Frontend
```bash
cd frontend
yarn install
# .env must point to backend, e.g.: REACT_APP_BACKEND_URL=http://localhost:8001
yarn start
```

App: http://localhost:3000

### 4. First login
Sign in with the admin credentials above, or click **"Sign Up"** to create a regular account.

## REST API (all routes prefixed with `/api`)

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account → `{token, user}` |
| POST | `/auth/login` | Login → `{token, user}` |
| GET | `/auth/me` | Current user |
| GET / POST | `/tasks` | List / Create |
| PUT / DELETE | `/tasks/{id}` | Update / Delete |
| GET / POST | `/resources` | List / Create |
| DELETE | `/resources/{id}` | Delete |
| GET / POST | `/groups` | List / Create |
| POST | `/groups/{id}/join` | Join |
| DELETE | `/groups/{id}` | Host or admin only |
| GET | `/study/today` | Today's session |
| POST | `/study/track` | Increment seconds |
| PUT | `/preferences` | Update name/theme/goal/notifications |
| POST | `/ai/chat` | **SSE stream** AI response |
| GET / DELETE | `/ai/history` | List / Clear chat |
| GET | `/dashboard` | Aggregated stats |
| POST | `/reset` | Clear current user's data |

## Premium?

**No.** Everything in this project is open source / free to use. Hosting on Emergent's preview is free; you only pay for AI calls if you exceed your **Emergent Universal Key** credit balance.

## Convert to pure MERN (Express/Node) — optional

Drop in an Express server that mirrors the same routes. Use:
- `express` + `cors` + `dotenv`
- `mongoose` for MongoDB
- `bcryptjs` + `jsonwebtoken` for auth
- For AI, call Gemini REST directly: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent`

The React frontend will work unchanged.

---

Built with ❤️ — happy studying!
