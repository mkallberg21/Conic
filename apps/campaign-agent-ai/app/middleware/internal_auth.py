"""
internal_auth.py — Shared middleware for all Conic AI microservices.

Validates the X-Internal-Secret header on every request (except /health).
The secret is loaded from the INTERNAL_API_SECRET environment variable.

Usage in main.py:
    from app.middleware.internal_auth import InternalAuthMiddleware
    app.add_middleware(InternalAuthMiddleware)
"""

import os
import hmac
import hashlib
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

_BYPASS_PATHS = {"/health", "/"}


class InternalAuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        secret = os.environ.get("INTERNAL_API_SECRET", "")
        if not secret:
            import warnings
            warnings.warn(
                "INTERNAL_API_SECRET is not set. AI service is UNAUTHENTICATED. "
                "Set this variable in production.",
                stacklevel=2,
            )
        self._expected_hash: bytes = hashlib.sha256(secret.encode()).digest()
        self._enforce: bool = bool(secret)

    async def dispatch(self, request: Request, call_next):
        if request.url.path in _BYPASS_PATHS or not self._enforce:
            return await call_next(request)

        provided = request.headers.get("X-Internal-Secret", "")
        provided_hash = hashlib.sha256(provided.encode()).digest()

        if not hmac.compare_digest(provided_hash, self._expected_hash):
            return JSONResponse(
                status_code=401,
                content={"detail": "Unauthorized — missing or invalid X-Internal-Secret"},
            )

        return await call_next(request)
