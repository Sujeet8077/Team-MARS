# 🚀 StudySync — Run Locally in 5 Steps

## What you need installed first
1. **Node.js 18+** → https://nodejs.org (download the LTS version)
2. **Python 3.10+** → https://www.python.org/downloads/
3. **MongoDB** → https://www.mongodb.com/try/download/community
   (after install, start it with `mongod` in a terminal, or use the MongoDB Compass app)
4. **Yarn** → after Node is installed, open a terminal and run: `npm install -g yarn`

## Step 1 — Open the folder in VS Code
- Extract the zip file
- Open VS Code → File → Open Folder → pick the `studysync_export` folder

## Step 2 — Rename the .env files
In VS Code's file tree, find these two files and rename them:
- `backend/.env.example` → rename to `backend/.env`
- `frontend/.env.example` → rename to `frontend/.env`

## Step 3 — Install backend
Open a terminal in VS Code (Terminal → New Terminal), then:
```bash
cd backend
pip install -r requirements.txt
```

## Step 4 — Install frontend
Open ANOTHER terminal (click the + icon next to your terminal), then:
```bash
cd frontend
yarn install
```

## Step 5 — Run both
**Terminal 1 (backend):**
```bash
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 2 (frontend):**
```bash
cd frontend
yarn start
```

Your browser will open at **http://localhost:3000** 🎉

## Login
- Email: `admin@studysync.com`
- Password: `Admin@123`

## Want the AI Tutor to work locally?
You need an Emergent LLM key. Paste it in `backend/.env`:
```
EMERGENT_LLM_KEY="paste-your-key-here"
```
Then restart the backend (Ctrl+C the terminal and run uvicorn again).

## Need help?
The full README is at `README.md` in this same folder.

Happy coding! — Team MARS
