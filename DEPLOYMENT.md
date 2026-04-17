# SafePay — Deployment Guide

Frontend → **Vercel** · Backend → **Render**

---

## 1. Deploy the Backend (Render)

### Option A — One-click via `render.yaml` (recommended)

1. Push this repo to GitHub.
2. Go to [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**.
3. Connect your repo. Render will auto-detect `backend/render.yaml`.
4. Click **Apply**. It will:
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Mount a 1 GB persistent disk at `/var/data` (SQLite + ML models survive restarts).
5. Wait ~3–5 min for first deploy. Copy your URL, e.g. `https://safepay-backend.onrender.com`.
6. Test: open `https://<your-url>/api/health` → should return `{"status":"ok",...}`.

### Option B — Manual Web Service

- **Root Directory:** `backend`
- **Runtime:** Python 3.11
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Env vars** (optional, for persistence):
  - `DATABASE_URL=sqlite:////var/data/upi_fraud.db`
  - `MODELS_DIR=/var/data/models`
- Add a persistent disk mounted at `/var/data` (1 GB).

> **Note:** Render free tier spins down after 15 min of inactivity — first request after idle takes ~30 s to cold-start. Fine for demos.

---

## 2. Deploy the Frontend (Vercel)

1. Go to [vercel.com/new](https://vercel.com/new) → import the repo.
2. **Root Directory:** `frontend`
3. Framework preset: **Vite** (auto-detected via `vercel.json`).
4. Add environment variable:
   - **Name:** `VITE_API_URL`
   - **Value:** your Render backend URL (no trailing slash), e.g. `https://safepay-backend.onrender.com`
5. Click **Deploy**. Done — visit the Vercel URL.

### Re-deploying after changing `VITE_API_URL`
Vite bakes env vars at build time. After changing `VITE_API_URL`, hit **Redeploy** in Vercel so the new value is compiled in.

---

## 3. Local Dev (unchanged)

```bash
# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt && python main.py

# Frontend (in another terminal)
cd frontend && npm install && npm run dev
```

Vite proxy forwards `/api/*` → `http://localhost:8000`, so locally you don't need `VITE_API_URL`.

---

## 4. Post-deploy sanity check

- Open the Vercel URL → Signup → go to **Profile → Seed 15 Transactions** → try **Simulate Fraud** and **Simulate Normal**.
- Open browser DevTools → Network → confirm requests hit your Render backend URL.
- Backend CORS is already `allow_origins=["*"]`. For production, restrict it to your Vercel domain in `backend/main.py`.

---

## 5. Files added for deployment

| File | Purpose |
|------|---------|
| `backend/render.yaml` | Render Blueprint (web service + disk) |
| `backend/.dockerignore` | Clean container builds |
| `frontend/vercel.json` | Vite framework + SPA rewrite |
| `frontend/.env.example` | `VITE_API_URL` template |
| `frontend/netlify.toml` | Optional Netlify fallback |
| `.gitignore` | Excludes `venv`, `node_modules`, DB, model pickles |

Also tweaked:

- `backend/database.py` — `DATABASE_URL` & `MODELS_DIR` now read from env.
- `backend/ml_engine.py` — uses `MODELS_DIR` env.
- `backend/main.py` — honours `$PORT`.
- `frontend/src/utils/api.js` — uses `VITE_API_URL` prefix when set.
