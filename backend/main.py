from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
import json
import random

from database import get_db, User, Transaction, DeviceLog, Payee, ReportedPayee
from schemas import (
    SignupRequest, SignupResponse,
    TransactionRequest, TransactionResponse,
    UserProfileResponse, SimulateRequest,
    ReportPayeeRequest,
)
from risk_calculator import calculate_risk
from ml_engine import UserMLModel
from geo_utils import travel_check

app = FastAPI(title="SafePay UPI Fraud Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "SafePay Fraud Engine"}


@app.post("/api/signup", response_model=SignupResponse)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(
        (User.email == req.email) | (User.phone == req.phone)
    ).first()
    if existing:
        return SignupResponse(
            user_id=existing.id,
            message="Welcome back!",
            upi_id=existing.upi_id or f"{req.phone}@safepay",
        )

    upi_id = f"{req.phone}@safepay"
    user = User(
        name=req.name,
        email=req.email,
        phone=req.phone,
        upi_id=upi_id,
        avg_amount=2400,
        avg_typing_speed=150,
        usual_hour_start=9,
        usual_hour_end=21,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return SignupResponse(
        user_id=user.id,
        message="Account created! Learning your behavior...",
        upi_id=upi_id,
    )


@app.post("/api/transaction", response_model=TransactionResponse)
def create_transaction(req: TransactionRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if payee is new
    existing_payee = db.query(Payee).filter(
        Payee.user_id == req.user_id,
        Payee.payee_upi == req.payee_upi
    ).first()

    is_new_payee = existing_payee is None
    if req.is_new_payee is None:
        req.is_new_payee = is_new_payee
    else:
        is_new_payee = req.is_new_payee

    # Update/create payee record
    if existing_payee:
        existing_payee.txn_count += 1
        existing_payee.first_used = existing_payee.first_used
    else:
        new_payee = Payee(
            user_id=req.user_id,
            payee_upi=req.payee_upi,
        )
        db.add(new_payee)

    # Check device log
    existing_device = db.query(DeviceLog).filter(
        DeviceLog.user_id == req.user_id,
        DeviceLog.device_id == req.device_id,
    ).first()
    if existing_device:
        existing_device.last_seen = datetime.utcnow()
        existing_device.ip_address = req.ip_address
    else:
        new_device = DeviceLog(
            user_id=req.user_id,
            device_id=req.device_id,
            ip_address=req.ip_address,
            city=req.ip_city,
            country=req.ip_country,
            is_vpn=req.is_vpn,
        )
        db.add(new_device)

    # Compute amount_vs_avg
    amount_vs_avg = req.amount / user.avg_amount if user.avg_amount > 0 else 1.0

    user.txn_count += 1
    txn_count = user.txn_count

    # FEATURE A: federated scammer blocklist lookup (applies even in learning mode)
    reported_count = db.query(ReportedPayee).filter(
        ReportedPayee.payee_upi == req.payee_upi
    ).count()

    # FEATURE B: geo-velocity (impossible travel) lookup
    last_txn = (
        db.query(Transaction)
        .filter(Transaction.user_id == req.user_id)
        .order_by(Transaction.created_at.desc())
        .first()
    )
    travel_alert = None
    if last_txn:
        travel_alert = travel_check(
            last_city=last_txn.ip_city,
            last_country=last_txn.ip_country,
            last_at=last_txn.created_at,
            cur_city=req.ip_city,
            cur_country=req.ip_country,
        )

    # Determine mode and risk
    if txn_count < 15 and reported_count == 0 and travel_alert is None:
        # Pure learning mode — but NOT if federated blocklist or impossible-travel triggered
        mode = "learning"
        action = "allow"
        risk_score = 0
        layer_scores = {"device": 0, "network": 0, "behavioral": 0, "transaction": 0}
        flags = []
        ml_detail = {}
    else:
        mode = "scoring" if txn_count >= 15 else "learning-override"
        data = req.model_dump()
        data["is_new_payee"] = is_new_payee
        data["amount_vs_avg"] = amount_vs_avg
        user_data = {
            "avg_amount": user.avg_amount or 2000,
            "avg_typing_speed": user.avg_typing_speed or 150,
            "usual_hour_start": user.usual_hour_start,
            "usual_hour_end": user.usual_hour_end,
            "reported_count": reported_count,
            "travel_alert": travel_alert,
        }
        result = calculate_risk(data, user_data)

        # IsolationForest ML adjustment (only if model is trained)
        if user.model_trained:
            ml_result = UserMLModel.predict(req.user_id, data)
            ml_adj = ml_result.get("adjustment", 0.0)
            ml_detail = ml_result
            drift = UserMLModel.get_drift_score(req.user_id, data)
            drift_adj = drift * 10
        else:
            ml_adj = 0.0
            drift = 0.0
            drift_adj = 0.0
            ml_detail = {}

        risk_score = max(0, min(100, result["risk_score"] + ml_adj + drift_adj))
        if risk_score < 40:
            action = "allow"
        elif risk_score < 70:
            action = "review"
        else:
            action = "block"
        layer_scores = result["layer_scores"]
        flags = result["flags"]
        if drift > 0.6:
            flags.append(f"Behavioral drift detected ({drift:.0%} deviation)")

    # Save transaction
    txn = Transaction(
        user_id=req.user_id,
        typing_speed_ms=req.typing_speed_ms,
        session_duration_sec=req.session_duration_sec,
        copy_paste_detected=req.copy_paste_detected,
        field_hesitation=req.field_hesitation,
        backspace_count=req.backspace_count,
        mouse_movement_score=req.mouse_movement_score,
        device_id=req.device_id,
        is_new_device=req.is_new_device,
        screen_resolution=req.screen_resolution,
        timezone=req.timezone,
        ip_address=req.ip_address,
        ip_country=req.ip_country,
        ip_city=req.ip_city,
        is_vpn=req.is_vpn,
        ip_changed=req.ip_changed,
        amount=req.amount,
        payee_upi=req.payee_upi,
        is_new_payee=is_new_payee,
        hour_of_day=req.hour_of_day,
        day_of_week=req.day_of_week,
        amount_vs_avg=amount_vs_avg,
        otp_time_sec=req.otp_time_sec,
        otp_paste_detected=req.otp_paste_detected,
        risk_score=risk_score,
        action=action,
        layer_scores=json.dumps(layer_scores),
        flags=json.dumps(flags),
        mode=mode,
    )
    db.add(txn)

    # Update user averages (rolling)
    if txn_count > 1:
        user.avg_amount = ((user.avg_amount * (txn_count - 1)) + req.amount) / txn_count
        if req.typing_speed_ms > 0:
            user.avg_typing_speed = (
                (user.avg_typing_speed * (txn_count - 1)) + req.typing_speed_ms
            ) / txn_count
    else:
        user.avg_amount = req.amount
        if req.typing_speed_ms > 0:
            user.avg_typing_speed = req.typing_speed_ms

    # Update usual hours
    hour = req.hour_of_day
    if hour < user.usual_hour_start:
        user.usual_hour_start = max(0, hour)
    if hour > user.usual_hour_end:
        user.usual_hour_end = min(23, hour)

    db.commit()
    db.refresh(txn)

    # Auto-train ML model
    just_trained = False
    if UserMLModel.should_train(txn_count, user.model_trained):
        try:
            success = UserMLModel.train(req.user_id, db)
            if success:
                was_trained = user.model_trained
                user.model_trained = True
                db.commit()
                just_trained = not was_trained
        except Exception:
            pass

    return TransactionResponse(
        transaction_id=txn.id,
        action=action,
        risk_score=round(risk_score, 1),
        layer_scores=layer_scores,
        flags=flags,
        mode=mode,
        txn_count=txn_count,
        just_trained=just_trained,
    )


@app.get("/api/user/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "upi_id": user.upi_id,
        "txn_count": user.txn_count,
        "model_trained": user.model_trained,
        "avg_amount": round(user.avg_amount, 2),
        "avg_typing_speed": round(user.avg_typing_speed, 2),
    }


@app.get("/api/user/{user_id}/transactions")
def get_transactions(user_id: int, db: Session = Depends(get_db)):
    txns = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(Transaction.created_at.desc())
        .limit(20)
        .all()
    )
    results = []
    for t in txns:
        results.append({
            "id": t.id,
            "amount": t.amount,
            "payee_upi": t.payee_upi,
            "risk_score": t.risk_score,
            "action": t.action,
            "mode": t.mode,
            "layer_scores": json.loads(t.layer_scores) if t.layer_scores else {},
            "flags": json.loads(t.flags) if t.flags else [],
            "created_at": t.created_at.isoformat() if t.created_at else "",
        })
    return results


@app.get("/api/user/{user_id}/profile")
def get_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    payees = db.query(Payee).filter(Payee.user_id == user_id).all()
    known_payees = [p.payee_upi for p in payees]

    baseline = UserMLModel.get_baseline(user_id)
    model_status = "Active" if user.model_trained else f"Learning ({user.txn_count}/15)"

    return {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "upi_id": user.upi_id,
        "txn_count": user.txn_count,
        "model_trained": user.model_trained,
        "model_status": model_status,
        "avg_amount": round(user.avg_amount, 2),
        "avg_typing_speed": round(user.avg_typing_speed, 2),
        "usual_hour_start": user.usual_hour_start,
        "usual_hour_end": user.usual_hour_end,
        "known_payees": known_payees,
        "baseline": baseline,
    }


@app.post("/api/simulate")
def simulate(req: SimulateRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.scenario == "fraud":
        return {
            "typing_speed_ms": 42,
            "otp_time_sec": 0.3,
            "session_duration_sec": 6,
            "copy_paste_detected": True,
            "field_hesitation": False,
            "backspace_count": 0,
            "mouse_movement_score": 12,
            "amount": 48000,
            "payee_upi": "scammer99@fraud",
            "is_new_payee": True,
            "hour_of_day": 2,
            "day_of_week": 3,
            "is_vpn": True,
            "is_new_device": True,
            "ip_country": "RU",
            "ip_city": "Moscow",
            "note": "Urgent transfer",
        }
    else:
        return {
            "typing_speed_ms": 175,
            "otp_time_sec": 4.2,
            "session_duration_sec": 34,
            "copy_paste_detected": False,
            "field_hesitation": False,
            "backspace_count": 3,
            "mouse_movement_score": 78,
            "amount": 2400,
            "payee_upi": "friend@upi",
            "is_new_payee": False,
            "hour_of_day": 19,
            "day_of_week": 1,
            "is_vpn": False,
            "is_new_device": False,
            "ip_country": "IN",
            "ip_city": "Mumbai",
            "note": "Dinner split",
        }


@app.post("/api/report-payee")
def report_payee(req: ReportPayeeRequest, db: Session = Depends(get_db)):
    """FEATURE A: Federated scammer blocklist.
    Any user can flag a UPI ID; future transactions to that UPI from ANY user
    are risk-boosted and warned. This is the network-effect defense — one
    victim saves the next."""
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # No duplicate reports from same user for same payee
    existing = db.query(ReportedPayee).filter(
        ReportedPayee.payee_upi == req.payee_upi,
        ReportedPayee.reporter_user_id == req.user_id,
    ).first()
    if existing:
        total = db.query(ReportedPayee).filter(
            ReportedPayee.payee_upi == req.payee_upi
        ).count()
        return {"message": "Already reported by you", "total_reports": total}

    report = ReportedPayee(
        payee_upi=req.payee_upi,
        reporter_user_id=req.user_id,
        reason=req.reason or "Suspicious transaction",
    )
    db.add(report)
    db.commit()

    total = db.query(ReportedPayee).filter(
        ReportedPayee.payee_upi == req.payee_upi
    ).count()
    return {"message": "Reported. Thank you for protecting others.", "total_reports": total}


@app.get("/api/reported/{payee_upi}")
def check_reported(payee_upi: str, db: Session = Depends(get_db)):
    """Check if a UPI ID is on the federated scammer blocklist.
    Frontend calls this on the Send Money page as user types the UPI ID."""
    reports = (
        db.query(ReportedPayee)
        .filter(ReportedPayee.payee_upi == payee_upi)
        .order_by(ReportedPayee.reported_at.desc())
        .all()
    )
    return {
        "payee_upi": payee_upi,
        "is_reported": len(reports) > 0,
        "total_reports": len(reports),
        "last_reported_at": reports[0].reported_at.isoformat() if reports else None,
        "reasons": list({r.reason for r in reports})[:5],
    }


@app.get("/api/user/{user_id}/analytics")
def get_analytics(user_id: int, db: Session = Depends(get_db)):
    """Dashboard analytics data — risk distribution, time series, model performance."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    txns = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(Transaction.created_at.asc())
        .all()
    )

    # Risk distribution
    allow_count = sum(1 for t in txns if t.action == "allow")
    review_count = sum(1 for t in txns if t.action == "review")
    block_count = sum(1 for t in txns if t.action == "block")

    # Risk over time
    risk_timeline = []
    for t in txns[-20:]:
        risk_timeline.append({
            "id": t.id,
            "score": t.risk_score,
            "action": t.action,
            "amount": t.amount,
            "time": t.created_at.isoformat() if t.created_at else "",
        })

    # Hour heatmap
    hour_data = [0] * 24
    for t in txns:
        hour_data[t.hour_of_day] += 1

    # Amount distribution
    amounts = [t.amount for t in txns if t.amount > 0]
    amount_stats = {
        "mean": round(sum(amounts) / len(amounts), 2) if amounts else 0,
        "max": max(amounts) if amounts else 0,
        "min": min(amounts) if amounts else 0,
    }

    # Top flags
    flag_counts = {}
    for t in txns:
        try:
            fl = json.loads(t.flags) if t.flags else []
            for f in fl:
                flag_counts[f] = flag_counts.get(f, 0) + 1
        except Exception:
            pass
    top_flags = sorted(flag_counts.items(), key=lambda x: -x[1])[:8]

    # Model info
    baseline = UserMLModel.get_baseline(user_id)

    return {
        "total_transactions": len(txns),
        "risk_distribution": {
            "allow": allow_count,
            "review": review_count,
            "block": block_count,
        },
        "risk_timeline": risk_timeline,
        "hour_heatmap": [{"hour": h, "count": c} for h, c in enumerate(hour_data)],
        "amount_stats": amount_stats,
        "top_flags": [{"flag": f, "count": c} for f, c in top_flags],
        "model_trained": user.model_trained,
        "model_type": "IsolationForest (scikit-learn)",
        "baseline": baseline,
    }


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
