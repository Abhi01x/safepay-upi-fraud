# SafePay — UPI Fraud Intelligence System

A production-quality UPI fraud detection system powered by Behavioral Biometrics and Machine Learning.

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS + Framer Motion
- **Backend**: FastAPI (Python) + SQLAlchemy + SQLite
- **ML Engine**: scikit-learn — per-user IsolationForest (same algorithm as AWS Fraud Detector)
- **Device Fingerprint**: FingerprintJS
- **IP Detection**: ip-api.com (free, no key needed)
- **Charts**: Recharts

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Backend runs at `http://localhost:8000`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

## Demo Scenarios

### Normal Transaction (Score < 40, ALLOW)
Go to **Profile → Simulate Normal** — pre-fills form with normal behavioral patterns.

### Fraud Transaction (Score > 70, BLOCK)
Go to **Profile → Simulate Fraud** — pre-fills form with suspicious patterns (fast typing, VPN, new device, high amount at 2 AM).

## How It Works

### 4-Layer Risk Scoring

| Layer | Weight | Signals |
|-------|--------|---------|
| Device | 25% | New device, emulator, screen mismatch |
| Network | 20% | VPN, IP change, foreign IP |
| Behavioral | 35% | Typing speed, OTP time, mouse movement, copy-paste |
| Transaction | 20% | Amount deviation, new payee, unusual hour |

### ML Model
- IsolationForest trained after 15 transactions
- Auto-retrains every 10 transactions
- Adjusts risk score by ±10 points based on anomaly detection

### Biometrics Collected (21 signals)
1. Typing speed (avg keystroke gap)
2. Session duration
3. Copy-paste detection
4. Field hesitation (>3s pause)
5. Backspace count
6. Mouse movement naturalness score
7. Device fingerprint
8. New device flag
9. Screen resolution
10. Timezone
11. IP address
12. IP country
13. IP city
14. VPN detection
15. IP change flag
16. Transaction amount
17. Payee UPI ID
18. New payee flag
19. Hour of day
20. Day of week
21. Amount vs user average

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/signup | Create account |
| POST | /api/transaction | Submit transaction with biometrics |
| GET | /api/user/{id} | Get user info |
| GET | /api/user/{id}/transactions | Transaction history |
| GET | /api/user/{id}/profile | Behavioral profile |
| POST | /api/simulate | Get pre-filled demo data |
| POST | /api/seed/{id} | Seed 15 training transactions |
