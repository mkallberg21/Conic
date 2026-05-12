"""
internal_auth.py — Hardened shared middleware for all Conic AI microservices.

Validates the X-Internal-Secret header on every request (except /health and /).
The secret is loaded from the INTERNAL_API_SECRET environment variable.

Production behaviour:
  - If INTERNAL_API_SECRET is not set AND environment is 'production',
    the process exits immediately with a non-zero code — the service will
    not start unauthenticated.
  - In development/test the service starts but logs a loud warning.

Usage in main.py:
    from app.middleware.internal_auth import InternalAuthMiddleware
    app.add_middleware(InternalAuthMiddleware)
"""

import os
import sys
import hmac
import hashlib
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("conic.internal_auth")

_BYPASS_PATHS: frozenset[str] = frozenset({"/health", "/"})


def _load_secret() -> tuple[bytes, bool]:
    """Return (expected_sha256_hash, enforce_auth).

    Raises SystemExit in production when the secret is absent.
    """
    env = os.environ.get("APP_ENV", os.environ.get("NODE_ENV", "development")).lower()
    secret = os.environ.get("INTERNAL_API_SECRET", "").strip()

    if not secret:
        if env == "production":
            # Hard-fail: refuse to run unauthenticated in production.
            logger.critical(
                "INTERNAL_API_SECRET is not set. "
                "Refusing to start unauthenticated in production. "
                "Set the INTERNAL_API_SECRET environment variable and restart."
            )
            sys.exit(1)
        else:
            logger.warning(
                "INTERNAL_API_SECRET is not set. "
                "AI service is running UNAUTHENTICATED. "
                "This is only acceptable in a local development environment."
            )
            return b"", False

    return hashlib.sha256(secret.encode()).digest(), True


_EXPECTED_HASH, _ENFORCE = _load_secret()


class InternalAuthMiddleware(BaseHTTPMiddleware):
    """Rejects requests that do not carry a valid X-Internal-Secret header."""

    async def dispatch(self, request: Request, call_next):
        if request.url.path in _BYPASS_PATHS or not _ENFORCE:
            return await call_next(request)

        provided = request.headers.get("X-Internal-Secret", "")
        provided_hash = hashlib.sha256(provided.encode()).digest()

        if not hmac.compare_digest(provided_hash, _EXPECTED_HASH):
            logger.warning(
                "Rejected unauthenticated request: %s %s from %s",
                request.method,
                request.url.path,
                request.client.host if request.client else "unknown",
            )
            return JSONResponse(
                status_code=401,
                content={"detail": "Unauthorized — missing or invalid X-Internal-Secret"},
            )

        return await call_next(request)
