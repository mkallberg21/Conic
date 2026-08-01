"""
Tests for the shared InternalAuthMiddleware — the security boundary that makes
the AI microservices reject unauthenticated calls (audit finding F11) and
refuse to start in production without a secret (finding H2).

The same middleware (identical security logic; only log/docstring text differs)
ships in all 8 AI services, so this suite is deployed into each service's tests/.

The middleware module is loaded directly by file path so the test does not pull
in the service's app package (routers/openai/numpy) — it exercises only the
security logic and needs just starlette + fastapi's TestClient.
"""

import hashlib
import importlib.util
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

_MODULE_PATH = Path(__file__).resolve().parent.parent / "app" / "middleware" / "internal_auth.py"
SECRET = "s3cr3t-value"


def _load(monkeypatch, *, secret, app_env="development"):
    """Freshly execute internal_auth.py against the given env (runs its import-time _load_secret())."""
    monkeypatch.setenv("APP_ENV", app_env)
    if secret is None:
        monkeypatch.delenv("INTERNAL_API_SECRET", raising=False)
    else:
        monkeypatch.setenv("INTERNAL_API_SECRET", secret)
    spec = importlib.util.spec_from_file_location("internal_auth_under_test", _MODULE_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _client(mod):
    app = FastAPI()
    app.add_middleware(mod.InternalAuthMiddleware)

    @app.get("/health")
    def health():
        return {"ok": True}

    @app.get("/score")
    def score():
        return {"score": 1}

    return TestClient(app)


class TestLoadSecret:
    def test_dev_without_secret_runs_unauthenticated(self, monkeypatch):
        mod = _load(monkeypatch, secret=None, app_env="development")
        _hash, enforce = mod._load_secret()
        assert enforce is False

    def test_secret_enables_enforcement_with_sha256_digest(self, monkeypatch):
        mod = _load(monkeypatch, secret=SECRET)
        digest, enforce = mod._load_secret()
        assert enforce is True
        assert digest == hashlib.sha256(SECRET.encode()).digest()

    def test_production_without_secret_refuses_to_start(self, monkeypatch):
        mod = _load(monkeypatch, secret=SECRET)
        monkeypatch.setenv("APP_ENV", "production")
        monkeypatch.delenv("INTERNAL_API_SECRET", raising=False)
        with pytest.raises(SystemExit):
            mod._load_secret()


class TestMiddleware:
    def test_enforced_rejects_request_without_secret(self, monkeypatch):
        client = _client(_load(monkeypatch, secret=SECRET))
        assert client.get("/score").status_code == 401

    def test_enforced_rejects_wrong_secret(self, monkeypatch):
        client = _client(_load(monkeypatch, secret=SECRET))
        assert client.get("/score", headers={"X-Internal-Secret": "wrong"}).status_code == 401

    def test_enforced_allows_correct_secret(self, monkeypatch):
        client = _client(_load(monkeypatch, secret=SECRET))
        r = client.get("/score", headers={"X-Internal-Secret": SECRET})
        assert r.status_code == 200
        assert r.json() == {"score": 1}

    def test_health_endpoint_bypasses_auth(self, monkeypatch):
        client = _client(_load(monkeypatch, secret=SECRET))
        assert client.get("/health").status_code == 200

    def test_dev_mode_allows_unauthenticated_calls(self, monkeypatch):
        client = _client(_load(monkeypatch, secret=None))
        assert client.get("/score").status_code == 200
