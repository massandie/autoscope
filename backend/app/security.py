"""Authentification JWT pour le portail mécanicien (accès client « avec autorisation »)."""

import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import models
from .database import get_db

JWT_SECRET = os.environ.get("AUTOSCOPE_JWT_SECRET", "dev-insecure-secret-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_MINUTES = 60 * 12  # 12h shift

_bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), password_hash.encode())


def create_access_token(mechanic_id: int, username: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_TTL_MINUTES)
    payload = {"sub": str(mechanic_id), "username": username, "exp": expires_at}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_mechanic(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> models.Mechanic:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentification requise")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Jeton invalide ou expiré")

    mechanic = db.query(models.Mechanic).filter_by(id=int(payload["sub"])).first()
    if mechanic is None:
        raise HTTPException(status_code=401, detail="Mécanicien introuvable")
    return mechanic


def seed_default_mechanic(db: Session) -> None:
    """Crée un compte mécanicien par défaut au premier démarrage si aucun n'existe."""
    if db.query(models.Mechanic).first() is not None:
        return

    username = os.environ.get("AUTOSCOPE_DEFAULT_MECHANIC_USERNAME", "mecanicien")
    password = os.environ.get("AUTOSCOPE_DEFAULT_MECHANIC_PASSWORD", "autoscope-demo-2026")

    mechanic = models.Mechanic(
        username=username,
        full_name="Mécanicien démo",
        password_hash=hash_password(password),
    )
    db.add(mechanic)
    db.commit()
