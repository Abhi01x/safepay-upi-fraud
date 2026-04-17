# SafePay — Frontend Build Prompt

> **Hand this entire document to the frontend developer (or paste into Cursor / Claude / Copilot). It contains everything they need to build the frontend without reading the existing codebase.**

---

## 1. Product in one paragraph

SafePay is a UPI (Indian payment) app clone that adds an AI fraud-detection layer. The **frontend passively collects 21 behavioral signals** (typing speed, mouse entropy, OTP time, device fingerprint, IP info, etc.) while the user pays, sends them with every transaction to the backend, and displays an explainable risk score + action (allow / review / block). The backend runs a **per-user IsolationForest ML model** that learns each user's normal behavior from their first 15 transactions, then scores every future transaction in real time.

You're building the frontend only. The backend is done and hosted separately.

---

## 2. Non-negotiable constraints

1. **Stack:** React 18 + Vite + TailwindCSS + Framer Motion + React Router v6. No Next.js, no SSR — this is a client-side SPA / PWA.
2. **Mobile-first.** Every screen must look perfect at 375×812 (iPhone SE). Use a max-width container on desktop.
3. **Dark theme only.** Deep background, purple accent (see §6).
4. **Passive signal collection must NEVER break.** The whole product value depends on it. Instrument every `<input>` and track keystroke timing, mouse movement, session duration, copy-paste events. See §7.
5. **No fake data / seed transactions.** Every transaction shown to the user must be real (created through the API).
6. **API URL is env-driven:** `import.meta.env.VITE_API_URL` (default `http://localhost:8000`).

---

## 3. Backend API — exhaustive reference

Base URL: `VITE_API_URL` + `/api`

### 3.1 `POST /signup`

Create or fetch a user. Returns existing user if phone/email matches.

**Request**
```json
{ "name": "Abhi", "email": "abhi@x.com", "phone": "9999999999" }
```

**Response**
```json
{
  "id": 1,
  "name": "Abhi",
  "upi_id": "abhi.9999@safepay",
  "txn_count": 0,
  "model_trained": false,
  "avg_amount": 0,
  "usual_hour_start": null,
  "usual_hour_end": null
}
```

### 3.2 `POST /transaction`

Submit a real transaction. Runs the risk engine + ML. Returns decision.

**Request** (all 21 signals — frontend must collect these passively)
```json
{
  "user_id": 1,
  "typing_speed_ms": 147,
  "session_duration_sec": 28,
  "copy_paste_detected": false,
  "field_hesitation": false,
  "backspace_count": 2,
  "mouse_movement_score": 72,

  "device_id": "fp_abc123",
  "is_new_device": false,
  "screen_resolution": "390x844",
  "timezone": "Asia/Kolkata",

  "ip_address": "103.21.1.1",
  "ip_country": "IN",
  "ip_city": "Mumbai",
  "is_vpn": false,
  "ip_changed": false,

  "amount": 2500.0,
  "payee_upi": "friend@okicici",
  "is_new_payee": true,
  "hour_of_day": 19,
  "day_of_week": 2,
  "amount_vs_avg": 1.04,

  "otp_time_sec": 4.2,
  "otp_paste_detected": false,
  "note": "Dinner"
}
```

**Response**
```json
{
  "transaction_id": 42,
  "risk_score": 18.5,
  "action": "allow",                 // "allow" | "review" | "block"
  "mode": "scoring",                 // "learning" (< 15 txns) | "scoring"
  "layer_scores": {
    "device": 5, "network": 10, "behavioral": 8, "transaction": 12
  },
  "flags": ["New payee", "Slightly high amount"],
  "ml_detail": { "adjustment": 2.1, "anomaly_score": 0.18, "confidence": 0.9 },
  "drift_score": 0.12,
  "just_trained": false              // true ONLY on the txn that activates the model
}
```

### 3.3 `POST /report-payee` (Federated Blocklist — Feature A)

When a user taps "Report as Scammer" on a blocked transaction, hit this.

**Request**
```json
{ "user_id": 1, "payee_upi": "scammer@bad", "reason": "Blocked txn" }
```

**Response**
```json
{ "message": "Reported. Thank you for protecting others.", "total_reports": 3 }
```

### 3.3b `GET /reported/{payee_upi}`

On the Send Money page, debounce 350 ms and check as user types the UPI. If `is_reported: true`, show a red warning banner under the UPI field.

**Response**
```json
{
  "payee_upi": "scammer@bad",
  "is_reported": true,
  "total_reports": 3,
  "last_reported_at": "2026-04-17T19:03:25",
  "reasons": ["Blocked txn", "Fake refund call"]
}
```

### 3.4 `GET /user/{user_id}`

```json
{ "id":1, "name":"Abhi", "upi_id":"...", "txn_count":8, "model_trained":false, ... }
```

### 3.5 `GET /user/{user_id}/transactions`

Returns array of past transactions (most recent first).
```json
[
  {
    "id": 42, "amount": 2500, "payee_upi": "friend@okicici",
    "risk_score": 18.5, "action": "allow",
    "layer_scores": {...}, "flags": [...],
    "created_at": "2025-04-17T18:30:00"
  }
]
```

### 3.6 `GET /user/{user_id}/profile`

User baseline summary for the Profile screen.
```json
{
  "name":"Abhi", "upi_id":"...", "txn_count": 8,
  "model_trained": false,
  "avg_amount": 2100, "typical_hour_range": "9-22",
  "known_payees": ["friend@okicici", "mom@okaxis"],
  "known_devices": 2
}
```

### 3.7 `GET /user/{user_id}/analytics`

Data for the Dashboard screen.
```json
{
  "total_transactions": 25,
  "risk_distribution": { "allow": 22, "review": 2, "block": 1 },
  "risk_timeline": [{"date":"2025-04-10","score":12}, ...],
  "hour_heatmap": [{"hour":0,"count":0}, ..., {"hour":23,"count":3}],
  "amount_stats": { "mean": 2100, "median": 1800, "max": 15000, "min": 50 },
  "top_flags": [{"flag":"New payee","count":5}, ...],
  "model_trained": true,
  "model_type": "IsolationForest (scikit-learn)",
  "baseline": { "typing_speed_ms": {"mean":150,"std":30,...}, ... }
}
```

### 3.8 `POST /simulate`

Generates pre-filled form data for demo purposes (doesn't create a txn). Used by the Profile "Simulate Fraud / Simulate Normal" buttons.

**Request**
```json
{ "user_id": 1, "scenario": "fraud" }   // "fraud" | "normal"
```

**Response:** a full transaction payload (same shape as `/transaction` request body). Navigate to Send Money with this as `location.state.prefill` to pre-fill the form.

### 3.9 `GET /health`

```json
{ "status": "ok", "service": "SafePay Fraud Engine" }
```

---

## 4. Screens to build (in nav order)

| Route | Screen | Purpose |
|-------|--------|---------|
| `/` | Splash | 2-sec branded loader → redirect to `/login` or `/home` |
| `/login` | Login | Enter 10-digit phone → `/signup` |
| `/signup` | Signup | Enter name + email → `POST /signup` → `/home` |
| `/home` | Home | Balance card, quick actions (Scan QR, Send Money, Profile), recent transactions, "How it works" |
| `/send` | Send Money | The main flow: QR scan + UPI input + amount + Live Risk Meter |
| `/otp` | OTP | 6-digit OTP entry, measures `otp_time_sec` + `otp_paste_detected` → `POST /transaction` → `/result` |
| `/result` | Result | Shows action (allow/review/block), score breakdown, flags. If `just_trained`, pop **AI Model Activated** modal |
| `/profile` | Profile | Learning progress (x/15), model info card, demo scenarios (simulate fraud/normal) |
| `/dashboard` | Analytics | Pie chart, timeline chart, hour heatmap, top flags, model card |

Add a **bottom nav** on Home / Send / Profile / Dashboard with 4 icons.

---

## 5. Signature feature: The "hackathon killer" screens

### 5.1 Live Risk Meter (Send Money page)

**Shown as user types UPI ID + amount.** Updates in real-time via debounced `/preview-risk` calls.

```
┌───────────────────────────────────────────┐
│ ● LIVE RISK SCORE         Low risk    18  │
│ ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ← colored bar (green<40, orange<70, red)
│ ┌──────┬──────┬──────┬──────┐             │
│ │DEVICE│ NET  │BEHAV │ TXN  │             │ ← 4 mini layer boxes
│ │  5   │  0   │  8   │  12  │             │
│ └──────┴──────┴──────┴──────┘             │
│ ⚠ New payee                                │
│ ⚠ Slightly high amount                     │
└───────────────────────────────────────────┘
```

- Bar color morphs smoothly with `framer-motion` (`animate={{ backgroundColor }}`)
- Layer boxes use their own color based on sub-score
- Top 2 flags shown, staggered fade-in

### 5.2 AI Model Activated modal (Result screen, on 15th txn)

Full-screen overlay that auto-pops 1.4 sec after success when `response.just_trained === true`:

```
           🛡 (glowing shield, spring scale)
        AI Model Activated
 Trained on 15 of your transactions
 IsolationForest is now live — the same
 anomaly detection algorithm used by
 AWS Fraud Detector and Stripe Radar.
      [ Continue → ]
```

### 5.3 QR Scanner (camera + upload + manual fallback)

Three modes in one component (`Camera` | `Upload` | `Manual`). Use `html5-qrcode` (`npm i html5-qrcode`). Parse UPI QR format:

```
upi://pay?pa=merchant@okaxis&pn=Merchant&am=100&cu=INR
```

Animated horizontal scan line, corner brackets overlay. Handle permission-denied gracefully — show error + offer Upload/Manual fallback. On successful decode → callback `{ upi, name, amount, note }` → parent closes modal + prefills form.

### 5.4 Live Biometric Indicators (Send Money page, above form)

4 small stats updated every 500ms to prove biometrics are being collected:

```
 LIVE BIOMETRIC COLLECTION
 ┌──────┬──────┬──────┬──────┐
 │147ms │  72  │  14  │ 23s  │
 │Typing│Mouse │Keys  │ Time │
 └──────┴──────┴──────┴──────┘
```

---

## 6. Design system

```js
// tailwind.config.js — required colors
colors: {
  'dark-bg': '#0A0A14',
  'dark-card': '#12121F',
  'dark-border': '#1F1F30',
  'primary': '#7C6FFF',
  'primary-dark': '#5B4ED4',
  'success': '#00D68F',
  'warning': '#FFB347',
  'danger': '#FF4757',
  'text-primary': '#FFFFFF',
  'text-secondary': '#B8B8D1',
  'text-muted': '#8B8BA7',
}
```

- **Font:** Inter (system fallback OK)
- **Radii:** `rounded-2xl` for cards, `rounded-btn` (1rem) for primary buttons, `rounded-full` for pills
- **Buttons:** primary = `bg-gradient-to-r from-primary to-primary-dark` + shadow glow
- **Shadows:** `glow-primary` utility = `box-shadow: 0 0 20px rgba(124,111,255,0.35)`
- **Animations:** prefer `framer-motion` — spring scale on buttons (`whileTap={{ scale: 0.97 }}`), slide-in for cards (`initial={{ y: 20, opacity: 0 }}`)

---

## 7. Passive signal collection — MUST implement

Create `src/utils/biometrics.js` with a `BiometricCollector` class:

```js
class BiometricCollector {
  startTracking() { /* attach keydown, mousemove, paste listeners */ }
  stopTracking()  { /* remove listeners */ }
  getData() {
    return {
      typing_speed_ms: <avg ms between keystrokes>,
      session_duration_sec: <seconds since startTracking>,
      copy_paste_detected: <boolean>,
      field_hesitation: <first-key-delay > 2s>,
      backspace_count: <integer>,
      mouse_movement_score: <0-100, higher = more natural>,
    };
  }
}
```

Instantiate with `useRef(new BiometricCollector())`, call `.startTracking()` in `useEffect`, call `.getData()` before `POST /transaction`.

Also create `src/utils/deviceFingerprint.js`:

```js
getDeviceFingerprint()  // returns FingerprintJS hash (library: @fingerprintjs/fingerprintjs)
getIpInfo()             // GET https://ipapi.co/json/ → { ip, country_code, city, org (for VPN detection) }
getDeviceSignals()      // { screen_resolution, timezone }
```

Store device fingerprint in `localStorage` as `knownDeviceId` after first transaction so you can compute `is_new_device`.

---

## 8. Required utilities / helpers

- `src/utils/api.js` — thin wrapper:
  ```js
  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  async function request(method, path, body) {
    const res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }
  export const api = {
    signup: d => request('POST','/signup', d),
    createTransaction: d => request('POST','/transaction', d),
    previewRisk: d => request('POST','/preview-risk', d),
    getUser: id => request('GET', `/user/${id}`),
    getTransactions: id => request('GET', `/user/${id}/transactions`),
    getProfile: id => request('GET', `/user/${id}/profile`),
    getAnalytics: id => request('GET', `/user/${id}/analytics`),
    simulate: (id, scenario) => request('POST','/simulate', { user_id: id, scenario }),
  };
  ```

- `localStorage` keys: `userId`, `userName`, `upiId`, `loginPhone`, `knownDeviceId`, `lastIp`, `avgAmount`

---

## 9. Critical UX flows (must work exactly)

### Flow A: New user signup → 15 txns → AI activates

1. `/login` → enter phone → `/signup`
2. `/signup` → name + email → `POST /signup` → `localStorage.userId = id` → `/home`
3. Profile shows `0/15` Learning Mode banner with progress bar
4. User does real transactions — each one increments `txn_count`, all `action="allow"`, score=0, `mode="learning"`
5. On the **15th transaction** response: `just_trained: true`
6. Result screen shows normal success, then 1.4s later the **AI Model Activated** modal pops
7. From txn 16 onwards, `mode="scoring"`, real risk scoring

### Flow B: Live risk visualization

1. On Send Money page, biometrics collector starts on mount
2. User types UPI ID → debounce 400ms → `POST /preview-risk` → Live Risk Meter updates
3. User types amount → debounce again → meter updates
4. Color changes smoothly green→orange→red as score crosses 40 and 70

### Flow C: QR scan

1. Home "Scan QR" tile OR Send Money "Scan UPI QR" button → opens full-screen modal
2. Camera permission requested → camera opens with back-facing lens
3. Corner brackets + animated scan line overlay
4. On decode → parse UPI URL → close modal → prefill form with `pa`/`pn`/`am`/`tn`
5. If camera fails → tabs let user switch to **Upload** (image file) or **Manual** (type UPI ID)

### Flow D: Fraud simulation (demo)

1. Profile → "Simulate Fraud" button → `POST /simulate { scenario: "fraud" }`
2. Navigate to `/send` with `state: { prefill: response }` → form pre-filled
3. User taps Pay → OTP → `POST /transaction` → `/result` → score >70, action "block"

---

## 10. Dependencies to install

```bash
npm install react react-dom react-router-dom \
  framer-motion recharts \
  @fingerprintjs/fingerprintjs html5-qrcode
npm install -D vite @vitejs/plugin-react tailwindcss postcss autoprefixer
```

Use **Recharts** for the Dashboard charts (Pie, Line, Bar).

---

## 11. Acceptance checklist

Build is done when ALL of these work:

- [ ] New user signup truly starts at `0/15` (no pre-seeded data)
- [ ] Biometrics counter visible on Send Money page, updates live
- [ ] QR scanner opens camera, scans a real UPI QR, auto-fills form
- [ ] QR scanner Upload and Manual fallbacks work
- [ ] Live Risk Meter updates within 500ms of typing amount
- [ ] Meter color morphs green → orange → red as score changes
- [ ] 15th txn triggers AI Model Activated modal (auto-pops after success)
- [ ] Dashboard charts render with real user data
- [ ] Simulate Fraud button → form prefilled → txn blocks with multiple flags
- [ ] Simulate Normal button → form prefilled → txn allows with score <25
- [ ] No console errors, no API errors in network tab
- [ ] Works on Chrome + Safari mobile

---

## 12. File structure (suggested)

```
frontend/
├── src/
│   ├── pages/
│   │   ├── Splash.jsx
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── Home.jsx
│   │   ├── SendMoney.jsx       ← includes LiveRiskMeter + QRScanner integration
│   │   ├── OTP.jsx
│   │   ├── ResultScreen.jsx    ← includes ActivationModal
│   │   ├── Profile.jsx
│   │   └── Dashboard.jsx
│   ├── components/
│   │   ├── QRScanner.jsx
│   │   ├── LiveRiskMeter.jsx
│   │   ├── BottomNav.jsx
│   │   ├── FlagRow.jsx
│   │   └── LayerBar.jsx
│   ├── utils/
│   │   ├── api.js
│   │   ├── biometrics.js
│   │   └── deviceFingerprint.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css                ← Tailwind + custom utilities
├── tailwind.config.js
├── vite.config.js
├── package.json
└── .env                         ← VITE_API_URL=http://localhost:8000
```

---

## 13. What NOT to do

- ❌ Don't create a `/simulate` button that writes fake transactions. `/simulate` only *prefills the form* — actual txn still goes through `/transaction`.
- ❌ Don't skip biometric collection — the whole product story breaks.
- ❌ Don't use `react-qr-reader` — it's deprecated. Use `html5-qrcode`.
- ❌ Don't put inline styles for colors — use Tailwind classes with the design system.
- ❌ Don't block the UI during `/preview-risk` — it's best-effort, silently swallow errors.
- ❌ Don't call `/transaction` on every keystroke — only on submit. Use `/preview-risk` for live feedback.

---

## 14. If you want reference screenshots

The existing implementation lives in the same repo under `frontend/src/`. If you're rewriting, you can compare to keep UX parity. But **do not copy code** — rewrite cleanly.

---

**Ship it. The backend is stable, the API contract is frozen, this doc is the source of truth.**
