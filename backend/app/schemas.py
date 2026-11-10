from datetime import datetime

from pydantic import BaseModel, ConfigDict


class Location(BaseModel):
    lat: float | None = None
    lon: float | None = None
    speed: float | None = None


class OBDData(BaseModel):
    rpm: float | None = None
    dtc: list[str] = []
    coolant_temp: float | None = None
    battery_voltage: float | None = None


class ReadingIn(BaseModel):
    vehicle_id: str
    timestamp: datetime
    location: Location = Location()
    driving_score: float | None = None
    events: list[str] = []
    obd: OBDData = OBDData()


class AlertOut(BaseModel):
    id: int
    category: str
    severity: str
    message: str
    recommended_action: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReadingOut(BaseModel):
    id: int
    timestamp: datetime
    lat: float | None
    lon: float | None
    speed: float | None
    driving_score: float | None
    events: list
    rpm: float | None
    dtc: list
    coolant_temp: float | None
    battery_voltage: float | None

    model_config = ConfigDict(from_attributes=True)


class IngestResult(BaseModel):
    reading: ReadingOut
    alerts: list[AlertOut]
    predicted_issue: str | None = None


class MechanicNoteIn(BaseModel):
    mechanic_name: str
    note: str
    recommended_parts: list[str] = []


class MechanicNoteOut(MechanicNoteIn):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VehicleSummary(BaseModel):
    vehicle_id: str
    open_alerts: int
    critical_alerts: int
    latest_driving_score: float | None
    latest_reading_at: datetime | None


class UsageScore(BaseModel):
    """Score télématique anonymisé pour l'assurance basée sur l'usage (UBI)."""

    anonymized_vehicle_ref: str
    trip_count: int
    average_driving_score: float | None
    harsh_events_rate: float
    predicted_maintenance_risk: float | None
    risk_tier: str


class MechanicLoginRequest(BaseModel):
    username: str
    password: str


class MechanicTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    full_name: str


class ServiceCompleteOut(BaseModel):
    vehicle_id: str
    odometer_km: float
    last_service_at: datetime
