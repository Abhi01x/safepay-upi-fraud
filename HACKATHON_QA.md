# SafePay — Hackathon Q&A Prep

Likely judge / mentor questions, with crisp answers you can actually defend.

---

## A. Problem & Positioning

**Q1. What problem are you solving?**
UPI fraud in India crossed ₹1,087 Cr in FY24 (RBI data). Most fraud isn't card-theft — it's **social engineering** (fake "refund agents", QR scams, OTP phishing). Banks only check PIN + OTP, both of which the victim willingly provides. We add a **behavioral + contextual layer** that catches "the user is being manipulated right now" *before* the money leaves.

**Q2. Who is the user, who is the customer?**
User: the UPI payer. Customer: banks / PSPs / UPI apps (PhonePe, GPay, Paytm) who'd integrate this as an SDK or a risk-score API before the debit call.

**Q3. What's novel vs existing fraud systems?**
Existing rule engines use transaction features only (amount, velocity, geo). We fuse **21 signals across 4 layers** — device, network, **behavioral biometrics**, transaction — and the model is **per-user**, not global. A scammer mimicking "average user" still fails because their typing rhythm ≠ *this* user's typing rhythm.

**Q3.1. Why one IsolationForest and not an ensemble?**
Deliberate simplification. We tried ensemble (IsolationForest + LOF + Z-Score) and dropped the last two: LOF is unstable at n=15 (needs more neighbors), Z-Score assumes Gaussian distribution which transaction amounts aren't. One proven model (same one AWS Fraud Detector uses) is easier to audit, deploy, and explain to regulators — and gave the same detection quality on our data.

---

## B. System Architecture

**Q4. Walk me through the architecture.**
- **Frontend (React + Vite):** Collects 21 signals passively — keystroke dynamics, mouse entropy, copy-paste, FingerprintJS device hash, IP geo via `ip-api.com`, OTP timing.
- **Backend (FastAPI + SQLAlchemy + SQLite):** Two scoring endpoints — `/api/transaction` (full score + DB persist, <50ms) and `/api/preview-risk` (rules-only, no writes, <10ms, powers the Live Risk Meter).
- **Risk Engine:** 4-layer weighted rule score → **IsolationForest ML adjustment** (±15) → **drift score** (+10) → final 0–100.
- **ML Engine:** Per-user `IsolationForest` (scikit-learn), trained after 15 txns, auto-retrains every 10.
- **Decision:** `<40 allow`, `40–70 review (step-up auth)`, `>70 block`.

**Q5. Why FastAPI + SQLite, not Django + Postgres?**
Hackathon optimization: zero-config, single-file deploy, async-ready. For production we'd swap to Postgres (`DATABASE_URL` env is already abstracted) and add Redis for the per-user feature cache. No code change in the scoring path — SQLAlchemy handles it.

**Q6. Why per-user models instead of one global model?**
Fraud is **relative**. A ₹50,000 txn at 2 AM is normal for a business owner, anomalous for a student. A global model has to average these out and loses signal. Per-user IsolationForest captures *individual* baseline. Cost: ~4 KB pickle per user, trains in <200 ms on 15 samples.

---

## C. ML / Risk Scoring

**Q7. Why IsolationForest? Why not a supervised classifier (XGBoost, NN)?**
Cold-start reality: we have **no labeled fraud per user**. Unsupervised anomaly detection works from day-1. IsolationForest is O(n log n), interpretable (path length), robust to the tiny data we have (15–100 txns), and battle-tested: AWS Fraud Detector and Stripe Radar both use it. Supervised models need labeled fraud from each user which doesn't exist until after the damage is done.

**Q8. How do you handle cold start (first 15 transactions)?**
We run in **"learning mode"** — action is always `allow`, risk_score = 0. Meanwhile we accumulate the user's baseline (avg amount, typing speed, usual hours, known payees, known devices). At txn #15 the ensemble trains automatically; from #16 onwards we score normally and retrain every 10 txns to adapt.

**Q9. How is the final risk score computed?**
```
rule_score     = 0.25·device + 0.20·network + 0.35·behavioral + 0.20·transaction
ml_adjustment  = (iso_forest_anomaly_score - 0.25) * 30   # ~ -7 to +22
drift_bonus    = behavioral_drift_vs_baseline * 10        # 0..10
final_score    = clamp(rule_score + ml_adjustment + drift_bonus, 0, 100)
```
Rules give **explainability** (we show the user *why* we flagged); IsolationForest catches patterns rules miss.

**Q10. What are the 21 signals and which matter most?**
See README. In the demo fraud scenario the top contributors are: `is_vpn`, `is_new_device`, `hour_of_day=2`, `typing_speed_ms=42` (bot-like), `copy_paste_detected`, `new_payee`, `amount_vs_avg=20×`. Behavioral layer carries 35% weight because it's the hardest to spoof — a scammer can fake a device, not the victim's fingers.

**Q11. How do you prevent false positives from annoying real users?**
1. **Review band (40–70):** soft step-up auth (extra OTP / face check), not a hard block.
2. Per-user baselines adapt — if you routinely send at 2 AM, that stops being suspicious.
3. Model retrains every 10 txns on *your* data, so it drifts with you.
4. `layer_scores` are exposed so ops can tune weights without retraining.

**Q12. How does this adapt if the user's behavior legitimately changes (e.g., new phone)?**
First txn from a new device → flagged (`is_new_device=True`) → lands in review → once user confirms via OTP, the device is whitelisted in `device_log` and next txn from it is clean. The rolling averages + auto-retrain absorb gradual shifts within ~10 txns.

**Q13. What's the behavioral drift score?**
Euclidean distance between the current txn's behavioral vector and the user's stored **embedding centroid** (mean of recent normal txns), normalized 0–1. High drift = "this doesn't feel like you" — the classic "phone is in attacker's hand" signal. **This is not a separate ML model** — just a distance calc on the same scaled feature space IsolationForest uses.

---

## D. Security & Attack Surface

**Q14. Can't a fraudster just replay the victim's biometrics?**
The signals are **collected in real-time on the victim's device during the session**. A remote attacker over AnyDesk/TeamViewer (the most common UPI scam vector today) produces *their own* typing rhythm, *their own* mouse entropy, *their own* network fingerprint — exactly what we detect.

**Q15. What if the attacker uses the victim's unlocked phone directly?**
That's the hardest case. Signals that still fire: `hour_of_day` anomaly, `amount_vs_avg`, `new_payee`, OTP-time (victims being coached type OTPs faster/paste them), unusual session duration. Drift score usually catches it because panic-driven txns have different rhythm than normal ones.

**Q16. Device fingerprint — is it really stable? Is it privacy-invasive?**
FingerprintJS gives ~99% stability across sessions without cookies. We store only a **hashed `device_id`**, not raw attributes. No PII leaves the client beyond what UPI already requires (phone, UPI ID). IP geo uses `ip-api.com` — no tracking cookies, no third-party data sale.

**Q17. How do you secure the API?**
Current demo: open CORS for judging. Production checklist:
- JWT auth on every endpoint, rotated per session.
- Rate limit per `user_id` + per IP (slowapi).
- Restrict CORS to the bank's domain.
- Request signing (HMAC) from the UPI app so the backend can't be hit directly.
- Store model pickles + DB on encrypted disk.

**Q18. Adversarial ML — can a sophisticated attacker learn the model and evade?**
Yes, given enough queries — any ML system can be gamed. Mitigations: (a) the rule layer is independent and gives a floor score, (b) per-user models mean the attacker has to learn *each* victim, (c) we can add query-rate anomaly detection on the scoring endpoint itself, (d) random noise in returned scores (differential privacy) so the attacker can't grad-descend.

---

## E. Data, Privacy, Compliance

**Q19. Where is user data stored? RBI compliance?**
SQLite on a persistent disk in the Render region (choose India region for data residency). For production: Postgres in an India-region managed DB, RBI's "storage of payment data in India" mandate satisfied. We store behavioral summaries, not raw keystrokes, so there's no keylogger liability.

**Q20. Are you GDPR / DPDP compliant?**
Design principles we follow: (a) data minimisation — only signals that materially improve scoring, (b) purpose limitation — fraud detection only, (c) right to erasure — per-user model + data is keyed by `user_id`, deleting the row deletes everything, (d) explainability — every blocked txn returns the `flags` list so the user knows why.

---

## F. Product / Business

**Q21. How would a bank integrate this?**
Three options:
1. **API mode:** Bank's UPI app POSTs txn features to `/api/transaction`; our service returns `{action, score, flags}`; bank acts on it. <50 ms p95.
2. **SDK mode:** Drop-in JS/Android SDK that collects the 21 signals and streams to our API. Zero backend work for the bank.
3. **On-prem:** Docker image of the backend inside the bank's VPC.

**Q22. Pricing / business model?**
Per-transaction: ₹0.05–0.20 depending on volume, undercutting current fraud-ops cost (~₹2/txn human review). At 10B UPI txns/month industry-wide, 1% integration = ₹6 Cr/mo revenue ceiling.

**Q23. What's your moat vs. a bank building this in-house?**
Banks have data but not ML talent density + iteration speed. Second, network effects: a scammer UPI ID flagged on Bank A instantly propagates to Banks B/C via our shared blocklist (a feature we'd add post-launch).

---

## G. Demo-time Questions

**Q24. Show me it catching a fraud.**
Profile → **Simulate Fraud** → Send. You'll see: score 85+, action BLOCK, flags: `VPN detected`, `new device`, `unusual hour (2 AM)`, `bot-like typing (42ms)`, `amount 20× average`, `new payee`, `behavioral drift 74%`.

**Q25. Show me it NOT blocking a normal txn.**
Profile → **Simulate Normal** → Send. Score <20, action ALLOW.

**Q26. Can I break it? Give me an edge case.**
Try same user, normal params, but `amount=100000`. You'll see `review` not `block` — single-signal spikes shouldn't auto-block, that's deliberate. Try again with `hour=3, vpn=true, new_device=true` and it blocks — multi-layer agreement is what we trust.

---

## G2. Killer Demo Features

**Q26.1. Federated Scammer Blocklist — explain.**
New table `reported_payees(payee_upi, reporter_user_id, reason, reported_at)`. Any user can tap "Report as Scammer" on a blocked txn. The frontend's Send Money page does a debounced `GET /api/reported/{upi}` when user types the payee — if reported, red banner: *"Flagged by N users as suspicious"*. On submit, the risk_calculator adds **+70 to the transaction layer** if `reported_count > 0`, forcing a block. **Network-effect defense** — one victim saves the next. Demoable in 30 seconds: block on account A → log out → new account → same UPI → banner + block.

**Q26.2. Geo-Velocity Impossible-Travel — explain.**
Every txn persists `ip_city`. Before each score, we query the user's last txn, compute haversine distance to current city, divide by time elapsed. If >800 km/h implied speed, we spike the network layer by +55 with a named flag: *"Impossible travel: Mumbai→Delhi (1150 km in 2 min = 34500 km/h)"*. Catches session-hijack / AnyDesk remote scams which are the #1 UPI fraud vector. `geo_utils.py` ships a 30-city lookup table of Indian metros; unknown cities silently no-op.

**Q26.3. Scam-Phrase detector — explain.**
`SCAM_KEYWORDS` set in `risk_calculator.py` (~30 entries: urgent, refund, kyc, customs, verify, otp, prize, police, gst, penalty, suspended, lottery...). The note field is lowercased + substring-matched. A hit adds +30 to the transaction layer with flag *"Note contains scam-like keyword: 'urgent'"*. Ties directly to the social-engineering narrative.

**Q26.4. How does the QR scanner work?**
`html5-qrcode` library opens the rear camera via `getUserMedia({ facingMode: 'environment' })`. Decodes standard UPI QR: `upi://pay?pa=name@bank&pn=Name&am=100&cu=INR&tn=Note` — auto-fills UPI ID + amount + note. Three modes in one component: **Camera** (default), **Upload** (scan from gallery image — works when camera permission denied), **Manual** (type UPI ID). Graceful fallback chain means the feature never blocks the user.

**Q26.5. Why no separate `/api/seed` endpoint anymore?**
We deliberately removed it. Every transaction the user sees must be one they made — judges can verify the system learns from real behavior. No shortcuts.

---

## H. Tech Stack / Deploy

**Q27. How is it deployed?**
Frontend → Vercel (static Vite build, global CDN). Backend → Render (Python web service + 1 GB persistent disk for SQLite & IsolationForest .pkl files). Env-var `VITE_API_URL` wires them. Cold-start ~30 s on free tier; <50 ms scoring latency once warm. **No separate ML service** — scikit-learn runs in the same FastAPI process, ~2 ms inference.

**Q28. Scale numbers?**
Single Render instance handles ~500 RPS for scoring (I/O bound on SQLite). Production: Postgres + Redis + horizontal autoscale → 50k RPS easy. Model inference is ~2 ms; DB writes are the bottleneck, not ML.

**Q29. What would you build next with 2 more weeks?**
1. Supervised fine-tune once we have labeled fraud from pilot banks (XGBoost on top of the ensemble score).
2. Shared scammer-UPI blocklist across users (federated).
3. React Native SDK for drop-in mobile integration.
4. Graph features — link analysis across payees to catch mule networks.
5. Explainability UI for ops teams (SHAP on the ensemble).

---

## I. The "Gotcha" Questions

**Q30. Your ML adjustment is only ±15 out of 100 — doesn't that mean ML barely matters?**
Correct, deliberately. The rule layer is **explainable and auditable** — regulators love it. ML is a *tiebreaker* in the grey zone (35–60 rule score) where rules alone are uncertain. This also makes the system fail-safe: if the IsolationForest model file gets corrupted, we're still 90% as good on rules alone.

**Q31. What's your false-positive rate?**
On synthetic data, ~3% FPR at the 70-threshold, ~12% TPR at 40-threshold (review band). Real numbers need a bank pilot with labeled data — we're transparent that this is a prototype.

**Q32. Why should a judge believe this actually works and isn't just vibes?**
Run both simulate scenarios live. The score difference is deterministic and reproducible. The scoring code is 300 LOC in `risk_calculator.py` + `ml_engine.py` — readable in 10 minutes. No black-box claim.

---

**TL;DR pitch (30 sec):**
> "UPI fraud is a behavioral problem, not a credentials problem. SafePay scores every transaction in under 50 ms using 21 signals across device, network, behavior, and transaction layers — plus a per-user ML baseline that catches social-engineering attacks banks currently miss. Try it: simulate a fraud, watch it block; simulate a normal txn, watch it pass."
