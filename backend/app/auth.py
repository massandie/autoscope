import os

from fastapi import Header, HTTPException

# For the MVP, partner API keys are static and set via env var (comma-separated).
# Replace with a proper per-partner key store + hashing before production use.
_VALID_API_KEYS = set(
    k.strip() for k in os.environ.get("AUTOSCOPE_PARTNER_API_KEYS", "demo-insurer-key").split(",") if k.strip()
)


def require_partner_api_key(x_api_key: str = Header(...)) -> str:
    if x_api_key not in _VALID_API_KEYS:
        raise HTTPException(status_code=401, detail="Clé API partenaire invalide")
    return x_api_key
