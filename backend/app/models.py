from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    """Naive UTC, matching the non-timezone-aware DateTime columns below (SQLite and Postgres alike)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vehicle_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    owner_name: Mapped[str] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    odometer_km: Mapped[float] = mapped_column(Float, default=0.0)
    last_service_odometer_km: Mapped[float] = mapped_column(Float, default=0.0)
    last_service_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    readings: Mapped[list["Reading"]] = relationship(back_populates="vehicle")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="vehicle")


class Reading(Base):
    __tablename__ = "readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    lat: Mapped[float] = mapped_column(Float, nullable=True)
    lon: Mapped[float] = mapped_column(Float, nullable=True)
    speed: Mapped[float] = mapped_column(Float, nullable=True)

    driving_score: Mapped[float] = mapped_column(Float, nullable=True)
    events: Mapped[list] = mapped_column(JSON, default=list)

    rpm: Mapped[float] = mapped_column(Float, nullable=True)
    dtc: Mapped[list] = mapped_column(JSON, default=list)
    coolant_temp: Mapped[float] = mapped_column(Float, nullable=True)
    battery_voltage: Mapped[float] = mapped_column(Float, nullable=True)

    vehicle: Mapped["Vehicle"] = relationship(back_populates="readings")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    reading_id: Mapped[int] = mapped_column(ForeignKey("readings.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    category: Mapped[str] = mapped_column(String)  # diagnostic | behavioral | predictive | maintenance
    severity: Mapped[str] = mapped_column(String)  # info | warning | critical
    message: Mapped[str] = mapped_column(String)
    recommended_action: Mapped[str] = mapped_column(String, nullable=True)

    vehicle: Mapped["Vehicle"] = relationship(back_populates="alerts")


class MechanicNote(Base):
    __tablename__ = "mechanic_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    mechanic_name: Mapped[str] = mapped_column(String)
    note: Mapped[str] = mapped_column(String)
    recommended_parts: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Mechanic(Base):
    __tablename__ = "mechanics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String)
    password_hash: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
