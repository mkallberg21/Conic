"""
state_rules.py — 50-state NIL rules table (normalized, maintained by compliance staff).

Endpoints:
  GET /state-rules             — all states (enacted + pending)
  GET /state-rules/:state      — one state's normalized rules
  POST /state-rules/sync       — (admin) reload the table from the JSON seed file
"""

import json
import logging
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger("conic.nil_compliance.state_rules")

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_SEED_FILE = _DATA_DIR / "state_nil_rules.json"

# In-memory cache — reloaded on POST /state-rules/sync or process restart.
_rules_cache: dict[str, dict[str, Any]] | None = None


def _load_rules() -> dict[str, dict[str, Any]]:
    global _rules_cache
    if _rules_cache is not None:
        return _rules_cache
    try:
        raw = _SEED_FILE.read_text(encoding="utf-8")
        _rules_cache = json.loads(raw)
        return _rules_cache
    except FileNotFoundError:
        logger.error("state_nil_rules.json not found at %s — rules lookup will return empty", _SEED_FILE)
        _rules_cache = {}
        return _rules_cache
    except json.JSONDecodeError:
        logger.exception("state_nil_rules.json is not valid JSON — rules lookup will return empty")
        _rules_cache = {}
        return _rules_cache


def _reload_rules() -> dict[str, dict[str, Any]]:
    """Force-reload from disk. Used by the admin sync endpoint."""
    global _rules_cache
    _rules_cache = None
    return _load_rules()


async def get_rules_for_state(state: str) -> dict[str, Any] | None:
    """Lookup a state's normalized NIL rules. Returns None if unknown."""
    rules = _load_rules()
    return rules.get(state.upper())


async def get_applicable_state_rules(
    state: str | None,
    deal_type: str,
) -> dict[str, Any]:
    """Best-effort: return the normalized rules for `state`, or an empty dict.

    This is the function the compliance AI routes call before prompting OpenAI — so
    the AI works from a maintained table, not from training-data memory.
    """
    if not state:
        return {}
    state_upper = state.upper()
    rules = await get_rules_for_state(state_upper)
    if rules is None:
        return {"unknown_state": True, "state": state_upper}
    return {
        "state": rules["name"],
        "state_code": state_upper,
        "enacted": rules["enacted"],
        "effective_date": rules.get("effective_date"),
        "requires_reporting": rules.get("requires_reporting", False),
        "disclosure_window_days": rules.get("disclosure_window_days"),
        "minor_protections": rules.get("minor_protections", False),
        "caps": rules.get("caps"),
        "fair_market_value": rules.get("fair_market_value", False),
        "notes": rules.get("notes", ""),
    }


# ─── Request / Response models ──────────────────────────────────────────────────────

class StateRuleResponse(BaseModel):
    state: str
    name: str
    enacted: bool
    effective_date: str | None
    requires_reporting: bool
    disclosure_window_days: int | None
    minor_protections: bool
    caps: dict[str, Any] | None
    fair_market_value: bool
    notes: str


class StateRuleListResponse(BaseModel):
    states: list[StateRuleResponse]
    enacted_count: int
    pending_count: int


class SyncRulesResponse(BaseModel):
    reloaded: bool
    state_count: int
    enacted_count: int
    pending_count: int


# ─── Route: all states ──────────────────────────────────────────────────────────────

@router.get("/state-rules", response_model=StateRuleListResponse, tags=["compliance"])
async def list_state_rules(
    enacted_only: bool = Query(False, description="Filter to enacted laws only"),
) -> StateRuleListResponse:
    """Return the full 50-state NIL rules table.

    Set `?enacted_only=true` to filter out states with no enacted NIL law.
    """
    rules = _load_rules()
    items: list[StateRuleResponse] = []
    enacted = 0
    pending = 0
    for code, data in sorted(rules.items()):
        if enacted_only and not data.get("enacted", False):
            pending += 1
            continue
        if not data.get("enacted", False):
            pending += 1
        else:
            enacted += 1
        items.append(
            StateRuleResponse(
                state=code,
                name=data.get("name", code),
                enacted=data.get("enacted", False),
                effective_date=data.get("effective_date"),
                requires_reporting=data.get("requires_reporting", False),
                disclosure_window_days=data.get("disclosure_window_days"),
                minor_protections=data.get("minor_protections", False),
                caps=data.get("caps"),
                fair_market_value=data.get("fair_market_value", False),
                notes=data.get("notes", ""),
            )
        )
    return StateRuleListResponse(
        states=items,
        enacted_count=enacted,
        pending_count=pending,
    )


# ─── Route: one state ───────────────────────────────────────────────────────────────

@router.get(
    "/state-rules/{state}",
    response_model=StateRuleResponse,
    responses={404: {"description": "State not in rules table"}},
    tags=["compliance"],
)
async def get_state_rule(state: str) -> StateRuleResponse:
    """Return the normalized NIL rules for one state (2-letter postal code)."""
    rules = _load_rules()
    key = state.upper()
    if key not in rules:
        raise HTTPException(
            status_code=404,
            detail=f"No NIL rules entry for state {key}. Add it to {str(_SEED_FILE)} and call POST /state-rules/sync.",
        )
    data = rules[key]
    return StateRuleResponse(
        state=key,
        name=data.get("name", key),
        enacted=data.get("enacted", False),
        effective_date=data.get("effective_date"),
        requires_reporting=data.get("requires_reporting", False),
        disclosure_window_days=data.get("disclosure_window_days"),
        minor_protections=data.get("minor_protections", False),
        caps=data.get("caps"),
        fair_market_value=data.get("fair_market_value", False),
        notes=data.get("notes", ""),
    )


# ─── Route: admin sync (reload from disk) ──────────────────────────────────────────

class SyncRulesRequest(BaseModel):
    pass


@router.post(
    "/state-rules/sync",
    response_model=SyncRulesResponse,
    tags=["compliance"],
)
async def sync_state_rules(_: SyncRulesRequest) -> SyncRulesResponse:
    """Reload the state rules table from the JSON seed file (admin only).

    In production this endpoint should be gated to ADMIN role. The seed file
    `apps/nil-compliance-ai/data/state_nil_rules.json` is the source of truth —
    edit that file and call this endpoint to apply without a redeploy.
    """
    rules = _reload_rules()
    enacted = sum(1 for d in rules.values() if d.get("enacted", False))
    pending = sum(1 for d in rules.values() if not d.get("enacted", False))
    logger.info("State rules reloaded: %d states (%d enacted, %d pending)", len(rules), enacted, pending)
    return SyncRulesResponse(
        reloaded=True,
        state_count=len(rules),
        enacted_count=enacted,
        pending_count=pending,
    )
