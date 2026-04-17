from pydantic import BaseModel
from typing import Optional, List, Dict


class SignupRequest(BaseModel):
    name: str
    email: str
    phone: str


class SignupResponse(BaseModel):
    user_id: int
    message: str
    upi_id: str


class TransactionRequest(BaseModel):
    user_id: int
    # Behavioral signals
    typing_speed_ms: float = 150
    session_duration_sec: float = 30
    copy_paste_detected: bool = False
    field_hesitation: bool = False
    backspace_count: int = 0
    mouse_movement_score: float = 50
    # Device signals
    device_id: str = ""
    is_new_device: bool = False
    screen_resolution: str = ""
    timezone: str = ""
    # Network signals
    ip_address: str = ""
    ip_country: str = ""
    ip_city: str = ""
    is_vpn: bool = False
    ip_changed: bool = False
    # Transaction signals
    amount: float = 0
    payee_upi: str = ""
    is_new_payee: bool = False
    hour_of_day: int = 12
    day_of_week: int = 0
    amount_vs_avg: float = 1.0
    # OTP signals
    otp_time_sec: float = 5.0
    otp_paste_detected: bool = False
    # Note
    note: str = ""


class TransactionResponse(BaseModel):
    transaction_id: int
    action: str
    risk_score: float
    layer_scores: Dict[str, float]
    flags: List[str]
    mode: str
    txn_count: int
    just_trained: bool = False


class UserProfileResponse(BaseModel):
    user_id: int
    name: str
    email: str
    phone: str
    upi_id: str
    txn_count: int
    model_trained: bool
    avg_amount: float
    avg_typing_speed: float
    usual_hour_start: int
    usual_hour_end: int
    known_payees: List[str]
    model_status: str


class SimulateRequest(BaseModel):
    user_id: int
    scenario: str  # "fraud" or "normal"


class ReportPayeeRequest(BaseModel):
    user_id: int
    payee_upi: str
    reason: str = "Suspicious transaction"
