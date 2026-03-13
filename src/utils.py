from __future__ import annotations

import os
import sqlite3
import unicodedata
from datetime import datetime, timezone
from typing import Dict, List, Optional


STATUS_FAMILIES = {
    "Open": {
        "order": 0,
        "statuses": [
            "declared",
            "reopened",
            "reopen",
            "re opened",
            "rouvert",
            "ouvert",
            "started",
            "planned",
            "planne",
            "prevu",
        ],
    },
    "Analyse Client": {
        "order": 1,
        "statuses": [
            "no customer answer",
            "waiting for customer",
            "en attente du client",
            "analyse client",
        ],
    },
    "Analyse Luxtrust": {
        "order": 2,
        "statuses": [
            "escalated",
            "in progress",
            "estimated lt",
            "new release",
            "work in progress",
            "to plan",
            "to analyse lt",
            "to analyse it",
            "pending",
            "test",
            "quote",
            "analyse luxtrust",
            "en cours",
        ],
    },
    "Closed": {
        "order": 3,
        "statuses": [
            "done",
            "pre completed",
            "cancelled",
            "canceled",
            "annule",
            "rejected",
            "rejete",
            "suspended",
            "published",
            "ferme",
            "closed",
            "resolu",
            "termine",
            "termine(e)",
        ],
        "jira": [
            "Canceled",
            "Closed",
            "Done",
            "PUBLISHED",
            "Pre Completed",
            "REJECTED",
            "Resolved",
            "Suspended",
        ],
    },
}

STATUS_FAMILY_LABELS = list(STATUS_FAMILIES.keys())

STATUS_FAMILY_ORDER = {
    name: cfg["order"]
    for name, cfg in STATUS_FAMILIES.items()
}

STATUS_FAMILY_MAP = {
    status: family
    for family, cfg in STATUS_FAMILIES.items()
    for status in cfg["statuses"]
}

JIRA_CLOSED_STATUSES_JQL = STATUS_FAMILIES["Closed"]["jira"]


def _normalize_for_match(value: Optional[str]) -> str:
    if not value:
        return ""
    s = value.strip()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return s.lower().strip()


def _normalize_status_key(value: Optional[str]) -> str:
    s = _normalize_for_match(value)
    for ch in ["_", "-", "/", "(", ")", "[", "]", "{", "}", ".", ",", ";", ":"]:
        s = s.replace(ch, " ")
    s = " ".join(s.split())
    return s


def _display_status_label(value: Optional[str]) -> str:
    raw = (value or "").strip()
    return raw if raw else "UNKNOWN"


def _map_status_to_family(value: Optional[str]) -> str:
    raw_label = _display_status_label(value)
    key = _normalize_status_key(value)

    if key in STATUS_FAMILY_MAP:
        return STATUS_FAMILY_MAP[key]

    if "customer" in key or "client" in key:
        return "Analyse Client"

    if "luxtrust" in key or "support" in key:
        return "Analyse Luxtrust"

    if "progress" in key or "analyse" in key or "analysis" in key:
        return "Analyse Luxtrust"

    if "pending" in key or "quote" in key or "release" in key or "test" in key:
        return "Analyse Luxtrust"

    if "plan" in key:
        return "Analyse Luxtrust"

    if (
        "open" in key
        or "ouvert" in key
        or "reopen" in key
        or "rouvert" in key
        or "declared" in key
        or "start" in key
        or "prevu" in key
    ):
        return "Open"

    if (
        "closed" in key
        or "done" in key
        or "reject" in key
        or "rejete" in key
        or "cancel" in key
        or "annule" in key
        or "publish" in key
        or "suspend" in key
    ):
        return "Closed"

    if "ferme" in key or "resolu" in key or "termine" in key:
        return "Closed"

    return f"Other: {raw_label}"


def _status_family_rank(family: str) -> int:
    return STATUS_FAMILY_ORDER.get(family, 999)


def _status_sort_key(status_value: Optional[str]) -> tuple[int, str, str]:
    raw_label = _display_status_label(status_value)
    family = _map_status_to_family(status_value)
    return (
        _status_family_rank(family),
        family.lower(),
        raw_label.lower(),
    )


def _parse_jira_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None

    s = value.strip()

    try:
        if s.endswith("Z"):
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        else:
            if len(s) >= 5 and (s[-5] in ["+", "-"]) and s[-2] != ":":
                s = s[:-2] + ":" + s[-2:]
            dt = datetime.fromisoformat(s)

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _age_hours(now_utc: datetime, then_utc: datetime) -> int:
    seconds = (now_utc - then_utc).total_seconds()
    if seconds < 0:
        seconds = 0
    return int(seconds // 3600)


def _duration_hours(start_utc: datetime, end_utc: datetime) -> float:
    seconds = (end_utc - start_utc).total_seconds()
    if seconds < 0:
        return 0.0
    return float(seconds) / 3600.0


def _connect_sqlite(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def _assignee_label(value: Optional[str]) -> str:
    return value if value and value.strip() else "Unassigned"


def _is_closed_status(status_value: Optional[str]) -> bool:
    return _map_status_to_family(status_value) == "Closed"


def _hours_from_seconds(seconds: Optional[int]) -> float:
    if seconds is None:
        return 0.0
    try:
        return float(seconds) / 3600.0
    except Exception:
        return 0.0


def _issues_table_exists(path: str) -> bool:
    if not os.path.exists(path):
        return False
    try:
        with sqlite3.connect(path) as conn:
            row = conn.execute(
                """
                SELECT name
                FROM sqlite_master
                WHERE type = 'table' AND name = 'issues'
                """
            ).fetchone()
            return row is not None
    except Exception:
        return False