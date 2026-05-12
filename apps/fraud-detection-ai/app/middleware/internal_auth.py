"""
internal_auth.py — Hardened shared middleware for Fraud Detection AI service.
"""

import os
import sys
import hmac
import hashlib
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("conic.fraud_detection.internal_auth")

_BYPASS_PATHS: frozenset[str] = frozenset({"/health", "/"})


def _load_secret() -> tuple[bytes, bool]:
    env = os.environ.get("APP_ENV", os.environ.get("NODE_ENV", "development")).lower()
    secret = os.environ.get("INTERNAL_API_SECRET", "").strip()

    if not secret:
        if env == "production":
            logger.critical("INTERNAL_API_SECRET is not set. Refusing to start in production.")
            sys.exit(1)
        else:
            logger.warning("INTERNAL_API_SECRET is not set. Running UNAUTHENTICATED (dev only).")
            return b"", False

    return hashlib.sha256(secret.encode()).digest(), True


_EXPECTED_HASH, _ENFORCE = _load_secret()


class InternalAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in _BYPASS_PATHS or not _ENFORCE:
            return await call_next(request)

        provided = request.headers.get("X-Internal-Secret", "")
        provided_hash = hashlib.sha256(provided.encode()).digest()

        if not hmac.compare_digest(provided_hash, _EXPECTED_HASH):
            logger.warning("Rejected unauthenticated request: %s %s", request.method, request.url.path)
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)

        return await call_next(request)
