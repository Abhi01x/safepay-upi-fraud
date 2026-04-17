# Backend Deployment Guide

Everything runs as **one FastAPI process** on **Render**. The database (SQLite), the ML model files, and the API are all in the same service.

> **TL;DR:** You don't need to deploy the DB or the ML separately. The `render.yaml` blueprint handles everything with a persistent disk.

---

## Architecture

```
┌────────────────────────────────────────────────┐
│          Render Web Service (Python 3.11)      │
│  ┌──────────────────────────────────────────┐  │
│  │  FastAPI app (uvicorn main:app)          │  │
│  │   ├─ /api/signup, /api/transaction, ...  │  │
│  │   └─ risk_calculator + ml_engine         │  │
│  └──────────────────────────────────────────┘  │
│         │                      │               │
│         ▼                      ▼               │
│  ┌────────────┐       ┌──────────────────┐     │
│  │ SQLite DB  │       │ IsolationForest  │     │
│  │ .db file   │       │ .pkl files       │     │
│  └──────┬─────┘       └────────┬─────────┘     │
│         │                      │               │
│         └──────────┬───────────┘               │
│                    ▼                           │
│     ┌──────────────────────────────┐           │
│     │  Persistent Disk (/var/data) │  ← survives restarts
│     └──────────────────────────────┘           │
└────────────────────────────────────────────────┘
```

**Why this works:**

- **Database (SQLite):** Single `.db` file on the persistent disk. No separate DB server, no connection string gymnastics. Perfect for a hackathon / MVP with <10k users.
- **ML Models:** Each user's IsolationForest is a tiny `.pkl` file (~4 KB) stored next to the DB. `joblib.load()` happens in the same process — no network call, no model server.
- **No GPU / inference server needed.** scikit-learn IsolationForest runs on CPU in ~2 ms.

---

## Step-by-Step: Deploy to Render

### 1. Push repo to GitHub

```bash
git add .
git commit -m "Deploy SafePay backend"
git push origin main
```

### 2. Create the Render service (Blueprint mode)

1. Go to <https://dashboard.render.com>
2. **New → Blueprint**
3. Connect your GitHub repo
4. Render auto-detects `backend/render.yaml`
5. Click **Apply**

That's it. Render will:
- Install Python 3.11
- Run `pip install -r requirements.txt`
- Mount a 1 GB persistent disk at `/var/data`
- Start `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Give you a URL like `https://safepay-backend-xxxx.onrender.com`

### 3. Verify it's live

```bash
curl https://<your-url>.onrender.com/api/health
# → {"status":"ok","service":"SafePay Fraud Engine"}
```

---

## What `render.yaml` does (already configured)

File: `@/Users/abhi/CascadeProjects/upi-fraud-system/backend/render.yaml`

```yaml
services:
  - type: web
    name: safepay-backend
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: DATABASE_URL
        value: sqlite:////var/data/upi_fraud.db
      - key: MODELS_DIR
        value: /var/data/models
    disk:
      name: safepay-data
      mountPath: /var/data
      sizeGB: 1
```

### Key env vars

| Env Var | Value | Purpose |
|---------|-------|---------|
| `DATABASE_URL` | `sqlite:////var/data/upi_fraud.db` | Tells SQLAlchemy where to put the DB |
| `MODELS_DIR` | `/var/data/models` | Where `ml_engine.py` saves `.pkl` files |
| `PORT` | (Render sets this) | Uvicorn binds to it |

Code reads these in `@/Users/abhi/CascadeProjects/upi-fraud-system/backend/database.py:7` and `@/Users/abhi/CascadeProjects/upi-fraud-system/backend/ml_engine.py:28`.

---

## Do I need to deploy the database separately?

**No.** SQLite is a file, not a server. It lives on the persistent disk with your app.

### When to migrate to Postgres

Migrate when ANY of these are true:
- You expect >10k concurrent users
- You need multiple backend instances (SQLite can't handle concurrent writes across processes)
- You need daily backups / point-in-time recovery
- Regulator asks about HA

### How to migrate (5-minute job, zero code changes)

1. Render → New → **PostgreSQL** → pick free tier → region: Singapore/Mumbai
2. Copy the **Internal Database URL** (starts with `postgres://`)
3. Install the driver in `requirements.txt`:
   ```
   psycopg2-binary==2.9.9
   ```
4. Update env var:
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/safepay
   ```
5. Redeploy. SQLAlchemy handles the rest — your models work unchanged.

One-time data migration (if you have SQLite data to preserve):
```bash
pip install pgloader   # or use a Python script
pgloader sqlite:///upi_fraud.db postgresql://...
```

---

## Do I need to deploy the ML separately?

**No.** scikit-learn IsolationForest runs **in-process** with FastAPI.

### How it works today

1. User hits `POST /api/transaction`
2. FastAPI handler calls `UserMLModel.predict(user_id, features)`
3. `predict()` does `joblib.load(f"{user_id}_model.pkl")` → scores feature vector → returns adjustment
4. Full round-trip: ~50 ms (most of it is DB + rule engine, ML is ~2 ms)

**No need for:**
- TensorFlow Serving / TorchServe
- SageMaker / Vertex AI endpoint
- Separate GPU server
- Redis / message queue

### When to split out ML

Only if ONE of these:
- You upgrade to a deep learning model (PyTorch / Transformers) → use a separate GPU instance
- You need model A/B testing at scale
- Your ML team wants independent deploy cadence

**For IsolationForest + SQLite: monolith is correct.** Don't prematurely over-engineer.

---

## Deployment checklist

Before clicking **Apply** on Render:

- [ ] Repo pushed to GitHub with latest code
- [ ] `backend/render.yaml` exists (it does)
- [ ] `backend/requirements.txt` has `fastapi`, `uvicorn`, `sqlalchemy`, `scikit-learn`, `joblib`, `numpy` (check)
- [ ] `backend/.gitignore` excludes `venv/`, `__pycache__/`, `models/`, `*.db` (check)
- [ ] `backend/main.py` reads `$PORT` env var (it does)
- [ ] `backend/database.py` reads `DATABASE_URL` env var (it does)
- [ ] `backend/ml_engine.py` reads `MODELS_DIR` env var (it does)
- [ ] Frontend `VITE_API_URL` points to Render URL (set after backend is live)

---

## Cold start behavior (free tier)

Render's free tier **spins down the service after 15 minutes of inactivity**. First request after idle:

- Spin-up: ~30 s (installing nothing, just starting the Python process)
- After that: normal ~50 ms requests

**For hackathon demo:** ping the service every 10 min with a cron job (or a free uptime monitor like UptimeRobot) to keep it warm before your presentation.

```bash
# Add to your laptop during demo day
while true; do curl -s https://<url>/api/health > /dev/null; sleep 600; done
```

---

## Persistence guarantees

- ✅ DB file survives redeploys, restarts, crashes
- ✅ ML `.pkl` files survive redeploys, restarts, crashes
- ⚠️ If you **delete the service**, the disk is deleted too
- ⚠️ Free tier disk is **not backed up** — export periodically if data matters

### Manual backup (one-liner)

```bash
# From Render Shell tab
tar czf /tmp/backup.tgz /var/data
# Then download via Render's file browser
```

---

## Scaling roadmap

| Users | Setup |
|-------|-------|
| < 10k | Current: SQLite + in-process IsolationForest ✅ |
| 10k – 500k | Postgres (Render managed) + same in-process ML |
| 500k – 10M | Postgres + Redis cache for baselines + horizontal FastAPI autoscale |
| > 10M | Postgres sharded + dedicated ML service (FastAPI ML-only) + Kafka |

For the hackathon: **you are at tier 1**. Monolith wins.

---

## Cost (as of 2025)

- **Free tier:** $0/month (spins down, good for demo)
- **Starter:** $7/month (always-on, 512 MB RAM, 1 GB disk) ← recommended after launch
- **With Postgres:** +$7/month for the managed DB

Total for a real startup launch: **$14/month**. That's it.

---

## Common issues

**"sqlite3.OperationalError: unable to open database file"**
→ Your `DATABASE_URL` path has 3 slashes (`sqlite:///relative`) instead of 4 (`sqlite:////absolute`). Use 4 for absolute paths like `/var/data/...`.

**"ModuleNotFoundError: No module named 'sklearn'"**
→ `requirements.txt` missing `scikit-learn`. Fix and redeploy.

**Models don't persist across restarts**
→ Check that `MODELS_DIR` is set to `/var/data/models`, not the default `models/` (which is inside the container and gets wiped).

**First request after idle takes 30s**
→ Free tier cold-start. Keep-warm ping or upgrade to Starter.

---

## Frontend deployment (separate)

See `@/Users/abhi/CascadeProjects/upi-fraud-system/DEPLOYMENT.md` for Vercel steps. Once backend is live:

1. Set `VITE_API_URL=https://<your-render-url>` in Vercel env vars
2. Redeploy frontend (Vite bakes env vars at build time)
3. Done.
