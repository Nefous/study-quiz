import hmac
import hashlib

from app.core.config import get_settings


def get_secret_key() -> str:
    return get_settings().SECRET_KEY


def hmac_sha256(message: str | bytes) -> str:
    key = get_secret_key().encode("utf-8")
    payload = message.encode("utf-8") if isinstance(message, str) else message
    return hmac.new(key, payload, hashlib.sha256).hexdigest()


def verify_hmac(message: str | bytes, signature: str) -> bool:
    expected = hmac_sha256(message)
    return hmac.compare_digest(expected, signature)
