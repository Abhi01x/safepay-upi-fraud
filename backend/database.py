from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./upi_fraud.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, unique=True, nullable=False)
    upi_id = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    txn_count = Column(Integer, default=0)
    model_trained = Column(Boolean, default=False)
    avg_amount = Column(Float, default=0.0)
    avg_typing_speed = Column(Float, default=0.0)
    usual_hour_start = Column(Integer, default=9)
    usual_hour_end = Column(Integer, default=21)


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    # Behavioral signals
    typing_speed_ms = Column(Float, default=0)
    session_duration_sec = Column(Float, default=0)
    copy_paste_detected = Column(Boolean, default=False)
    field_hesitation = Column(Boolean, default=False)
    backspace_count = Column(Integer, default=0)
    mouse_movement_score = Column(Float, default=50)
    # Device signals
    device_id = Column(String, default="")
    is_new_device = Column(Boolean, default=False)
    screen_resolution = Column(String, default="")
    timezone = Column(String, default="")
    # Network signals
    ip_address = Column(String, default="")
    ip_country = Column(String, default="")
    ip_city = Column(String, default="")
    is_vpn = Column(Boolean, default=False)
    ip_changed = Column(Boolean, default=False)
    # Transaction signals
    amount = Column(Float, default=0)
    payee_upi = Column(String, default="")
    is_new_payee = Column(Boolean, default=False)
    hour_of_day = Column(Integer, default=12)
    day_of_week = Column(Integer, default=0)
    amount_vs_avg = Column(Float, default=1.0)
    # OTP signals
    otp_time_sec = Column(Float, default=5.0)
    otp_paste_detected = Column(Boolean, default=False)
    # Risk assessment
    risk_score = Column(Float, default=0)
    action = Column(String, default="allow")
    layer_scores = Column(Text, default="{}")
    flags = Column(Text, default="[]")
    mode = Column(String, default="learning")
    created_at = Column(DateTime, default=datetime.utcnow)


class DeviceLog(Base):
    __tablename__ = "device_log"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    device_id = Column(String, default="")
    ip_address = Column(String, default="")
    city = Column(String, default="")
    country = Column(String, default="")
    is_vpn = Column(Boolean, default=False)
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)


class Payee(Base):
    __tablename__ = "payees"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    payee_upi = Column(String, nullable=False)
    first_used = Column(DateTime, default=datetime.utcnow)
    txn_count = Column(Integer, default=1)


class ReportedPayee(Base):
    """Federated scammer blocklist. Any user can flag a UPI ID as fraud;
    future transactions to that UPI (for ALL users) are risk-boosted + warned."""
    __tablename__ = "reported_payees"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    payee_upi = Column(String, nullable=False, index=True)
    reporter_user_id = Column(Integer, nullable=False)
    reason = Column(String, default="Suspicious transaction")
    reported_at = Column(DateTime, default=datetime.utcnow)


MODELS_DIR = os.getenv("MODELS_DIR", "models")
os.makedirs(MODELS_DIR, exist_ok=True)
Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
