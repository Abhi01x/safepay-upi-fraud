from typing import Dict, List, Tuple

# ---------------------------------------------------------------------------
# Scam-phrase dictionary (FEATURE C)
# Social-engineering UPI scams almost always include one of these words in
# the note/reason field. A hit spikes the transaction layer.
# ---------------------------------------------------------------------------
SCAM_KEYWORDS = {
    "urgent", "urgently", "emergency", "immediately", "asap",
    "refund", "refunding", "reimburse",
    "customs", "customs duty", "duty",
    "kyc", "kyc expired", "kyc update", "re-kyc",
    "verify", "verification", "verified",
    "otp", "pin", "password",
    "prize", "won", "winner", "lottery", "congratulations",
    "tax", "gst", "penalty", "fine",
    "suspended", "blocked account", "frozen",
    "police", "cbi", "arrest", "court", "fir",
    "electricity bill", "power cut", "disconnect",
    "cashback", "reward",
}


def detect_scam_phrase(note: str) -> Tuple[bool, str]:
    if not note:
        return False, ""
    low = note.lower()
    for kw in SCAM_KEYWORDS:
        if kw in low:
            return True, kw
    return False, ""



def calculate_device_score(data: dict, user_data: dict) -> Tuple[float, List[str]]:
    score = 0
    flags = []

    if data.get("is_new_device", False):
        score += 30
        flags.append("New device detected")

    screen_res = data.get("screen_resolution", "")
    if screen_res:
        try:
            w, h = screen_res.split("x")
            w, h = int(w), int(h)
            if w < 300 or h < 500:
                score += 15
                flags.append("Unusual screen resolution")
            if w == 800 and h == 600:
                score += 60
                flags.append("Emulator suspected (800x600)")
        except (ValueError, AttributeError):
            pass

    return min(score, 100), flags


def calculate_network_score(data: dict, user_data: dict = None) -> Tuple[float, List[str]]:
    user_data = user_data or {}
    score = 0
    flags = []

    if data.get("is_vpn", False):
        score += 45
        flags.append("VPN/Proxy detected")

    if data.get("ip_changed", False):
        score += 25
        flags.append("IP address changed from last session")

    ip_country = data.get("ip_country", "IN")
    if ip_country and ip_country.upper() != "IN" and ip_country.upper() != "INDIA":
        score += 40
        flags.append(f"Foreign IP detected ({ip_country})")

    # FEATURE B: geo-velocity (impossible travel) detection
    travel = user_data.get("travel_alert")
    if travel:
        score += 55
        flags.append(
            f"Impossible travel: {travel['from_city']}→{travel['to_city']} "
            f"({travel['distance_km']} km in {travel['minutes']} min = "
            f"{int(travel['implied_kmh'])} km/h)"
        )

    return min(score, 100), flags


def calculate_behavioral_score(data: dict, user_data: dict) -> Tuple[float, List[str]]:
    score = 0
    flags = []

    baseline_typing = user_data.get("avg_typing_speed", 150)
    if baseline_typing > 0:
        current_typing = data.get("typing_speed_ms", 150)
        if current_typing > 0:
            ratio = baseline_typing / current_typing if current_typing > 0 else 1
            if ratio > 3:
                score += 60
                flags.append(f"Typing speed {ratio:.1f}x faster than usual")
            elif ratio > 2:
                score += 40
                flags.append(f"Typing speed {ratio:.1f}x faster than usual")

    otp_time = data.get("otp_time_sec", 5.0)
    if otp_time < 0.5:
        score += 75
        flags.append(f"OTP entered in {otp_time}s (bot behavior)")
    elif otp_time < 1.0:
        score += 55
        flags.append(f"OTP entered in {otp_time}s (suspiciously fast)")

    if data.get("copy_paste_detected", False):
        score += 25
        flags.append("UPI ID was copy-pasted")

    session_dur = data.get("session_duration_sec", 30)
    if session_dur < 5:
        score += 35
        flags.append(f"Session too short ({session_dur}s)")

    backspace_count = data.get("backspace_count", 0)
    amount = data.get("amount", 0)
    if backspace_count == 0 and amount > 10000:
        score += 20
        flags.append("No corrections on high-value transaction")

    mouse_score = data.get("mouse_movement_score", 50)
    if mouse_score < 30:
        score += 30
        flags.append(f"Unnatural mouse movement (score: {mouse_score})")

    if data.get("otp_paste_detected", False):
        score += 20
        flags.append("OTP was pasted (possible interception)")

    if data.get("field_hesitation", False):
        score += 5

    return min(score, 100), flags


def calculate_transaction_score(data: dict, user_data: dict) -> Tuple[float, List[str]]:
    score = 0
    flags = []

    avg_amount = user_data.get("avg_amount", 2000)
    amount = data.get("amount", 0)

    if avg_amount > 0 and amount > 0:
        ratio = amount / avg_amount
        if ratio > 10:
            score += 65
            flags.append(f"Amount {ratio:.1f}x higher than average (₹{avg_amount:.0f})")
        elif ratio > 5:
            score += 45
            flags.append(f"Amount {ratio:.1f}x higher than average (₹{avg_amount:.0f})")

    is_new_payee = data.get("is_new_payee", False)
    if is_new_payee and amount > 10000:
        score += 35
        flags.append(f"New payee with high amount (₹{amount:,.0f})")

    hour = data.get("hour_of_day", 12)
    usual_start = user_data.get("usual_hour_start", 9)
    usual_end = user_data.get("usual_hour_end", 21)
    if hour < usual_start or hour > usual_end:
        score += 25
        flags.append(f"Unusual time ({hour}:00, usual: {usual_start}-{usual_end})")

    if amount > 5000 and amount % 1000 == 0:
        score += 15
        flags.append(f"Round amount ₹{amount:,.0f}")

    # FEATURE C: scam-phrase detector on the note field
    note = data.get("note", "") or ""
    hit, kw = detect_scam_phrase(note)
    if hit:
        score += 30
        flags.append(f"Note contains scam-like keyword: '{kw}'")

    # FEATURE A: federated scammer blocklist
    reported_count = user_data.get("reported_count", 0)
    if reported_count > 0:
        score += 70  # heavy bonus — force block territory
        flags.append(f"⚠ Payee reported as scammer by {reported_count} user(s)")

    return min(score, 100), flags


def calculate_risk(data: dict, user_data: dict) -> dict:
    device_score, device_flags = calculate_device_score(data, user_data)
    network_score, network_flags = calculate_network_score(data, user_data)
    behavioral_score, behavioral_flags = calculate_behavioral_score(data, user_data)
    transaction_score, transaction_flags = calculate_transaction_score(data, user_data)

    raw = (
        device_score * 0.25 +
        network_score * 0.20 +
        behavioral_score * 0.35 +
        transaction_score * 0.20
    )

    all_flags = device_flags + network_flags + behavioral_flags + transaction_flags

    final_score = max(0, min(100, raw))

    if final_score < 40:
        action = "allow"
    elif final_score < 70:
        action = "review"
    else:
        action = "block"

    return {
        "risk_score": round(final_score, 1),
        "action": action,
        "layer_scores": {
            "device": round(device_score, 1),
            "network": round(network_score, 1),
            "behavioral": round(behavioral_score, 1),
            "transaction": round(transaction_score, 1),
        },
        "flags": all_flags,
    }
