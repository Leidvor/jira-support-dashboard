from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from ..config import get_sqlite_path
from ..utils import (
    _age_hours,
    _assignee_label,
    _connect_sqlite,
    _duration_hours,
    _is_closed_status,
    _issues_table_exists,
    _map_status_to_family,
    _parse_jira_dt,
)

ALLOWED_DATE_FIELDS = {"created", "updated", "resolved"}
PERIOD_OPTIONS = [0, 7, 30, 90, 180, 365]


def _safe_project_key(value: Optional[str]) -> str:
    if value and str(value).strip():
        return str(value).strip()
    return "UNKNOWN"


def _is_high_or_critical(priority: Optional[str]) -> bool:
    if not priority:
        return False
    normalized = str(priority).strip().lower()
    return normalized in {"high", "critical", "critique"}


def _row_project_key(row_value: Optional[str]) -> str:
    return _safe_project_key(row_value)


def _normalize_date_field(date_field: str) -> str:
    value = (date_field or "updated").strip().lower()
    return value if value in ALLOWED_DATE_FIELDS else "updated"


def _get_row_dt(row: Any, field: str) -> Optional[datetime]:
    return _parse_jira_dt(row[field])


def _empty_coverage(requested_days: int) -> Dict[str, Any]:
    return {
        "data_start_date": None,
        "data_end_date": None,
        "max_available_days": 0,
        "allowed_periods": [0, 7],
        "effective_days": 0 if requested_days == 0 else 7,
        "period_is_limited": True,
        "coverage_notice": "Available review period is currently limited because no synced Jira data is available yet.",
    }


def _compute_data_coverage(rows: List[Any], requested_days: int) -> Dict[str, Any]:
    if not rows:
        return _empty_coverage(requested_days)

    earliest_created: Optional[datetime] = None
    latest_seen: Optional[datetime] = None

    for row in rows:
        dt_created = _parse_jira_dt(row["created"])
        if dt_created and (earliest_created is None or dt_created < earliest_created):
            earliest_created = dt_created

        for field in ("created", "updated", "resolved"):
            dt = _parse_jira_dt(row[field])
            if dt and (latest_seen is None or dt > latest_seen):
                latest_seen = dt

    if earliest_created is None:
        return _empty_coverage(requested_days)

    now = datetime.now(timezone.utc)
    max_available_days = max(1, (now.date() - earliest_created.date()).days + 1)

    allowed_periods = [0] + [period for period in [7, 30, 90, 180, 365] if period <= max_available_days]

    if requested_days == 0:
        effective_days = max_available_days
    else:
        selectable_periods = [p for p in allowed_periods if p != 0]
        if not selectable_periods:
            selectable_periods = [7]
        effective_days = requested_days if requested_days in selectable_periods else selectable_periods[-1]

    period_is_limited = max_available_days < 365

    if requested_days == 0:
        if period_is_limited:
            coverage_notice = (
                f"All time currently reflects the full synced Jira scope, which starts on {earliest_created.date().isoformat()}."
            )
        else:
            coverage_notice = None
    elif requested_days > effective_days:
        coverage_notice = (
            f"Selected review period was reduced to {effective_days} days because the synced Jira data "
            f"currently starts on {earliest_created.date().isoformat()}."
        )
    elif period_is_limited:
        coverage_notice = (
            f"Available review period is currently limited to {max_available_days} days by the synced Jira data scope."
        )
    else:
        coverage_notice = None

    return {
        "data_start_date": earliest_created.date().isoformat(),
        "data_end_date": latest_seen.date().isoformat() if latest_seen else None,
        "max_available_days": max_available_days,
        "allowed_periods": allowed_periods,
        "effective_days": effective_days,
        "period_is_limited": period_is_limited,
        "coverage_notice": coverage_notice,
    }
    

def get_clients_overview() -> Dict[str, Any]:
    db_path = get_sqlite_path()

    if not _issues_table_exists(db_path):
        return {
            "clients": [],
            "total_clients": 0,
            "total_tickets": 0,
            "total_open": 0,
            "total_closed": 0,
            "global_avg_resolution_hours": None,
            "total_time_spent_hours": 0.0,
        }

    agg: Dict[str, Dict[str, Any]] = {}

    with _connect_sqlite(db_path) as conn:
        rows = conn.execute(
            """
            SELECT project_key, status, created, resolved, time_spent_seconds
            FROM issues
            """
        ).fetchall()

    for r in rows:
        project_key = _safe_project_key(r["project_key"])

        entry = agg.get(project_key)
        if entry is None:
            entry = {
                "project_key": project_key,
                "total_issues": 0,
                "open_issues": 0,
                "closed_issues": 0,
                "time_spent_seconds": 0,
                "resolved_issues_with_dates": 0,
                "resolution_total_hours": 0.0,
            }
            agg[project_key] = entry

        entry["total_issues"] += 1

        if _is_closed_status(r["status"]):
            entry["closed_issues"] += 1
        else:
            entry["open_issues"] += 1

        entry["time_spent_seconds"] += int(r["time_spent_seconds"] or 0)

        dt_created = _parse_jira_dt(r["created"])
        dt_resolved = _parse_jira_dt(r["resolved"])
        if dt_created and dt_resolved:
            resolution_hours = _duration_hours(dt_created, dt_resolved)
            entry["resolved_issues_with_dates"] += 1
            entry["resolution_total_hours"] += resolution_hours

    clients: List[Dict[str, Any]] = []
    total_tickets = 0
    total_open = 0
    total_closed = 0
    total_time_spent_hours = 0.0
    global_resolution_total_hours = 0.0
    global_resolution_count = 0

    for entry in agg.values():
        total_issues = int(entry["total_issues"])
        time_spent_hours = float(entry["time_spent_seconds"]) / 3600.0
        resolved_count = int(entry["resolved_issues_with_dates"])
        avg_resolution_hours = (
            float(entry["resolution_total_hours"]) / resolved_count
            if resolved_count > 0
            else None
        )
        avg_hours_per_ticket = (
            time_spent_hours / total_issues if total_issues > 0 else 0.0
        )

        clients.append(
            {
                "project_key": entry["project_key"],
                "total_issues": total_issues,
                "open_issues": int(entry["open_issues"]),
                "closed_issues": int(entry["closed_issues"]),
                "time_spent_hours": time_spent_hours,
                "avg_hours_per_ticket": avg_hours_per_ticket,
                "avg_resolution_hours": avg_resolution_hours,
                "resolved_issues_with_dates": resolved_count,
            }
        )

        total_tickets += total_issues
        total_open += int(entry["open_issues"])
        total_closed += int(entry["closed_issues"])
        total_time_spent_hours += time_spent_hours
        global_resolution_total_hours += float(entry["resolution_total_hours"])
        global_resolution_count += resolved_count

    clients.sort(key=lambda item: (-int(item["total_issues"]), item["project_key"]))

    global_avg_resolution_hours = (
        global_resolution_total_hours / global_resolution_count
        if global_resolution_count > 0
        else None
    )

    return {
        "clients": clients,
        "total_clients": len(clients),
        "total_tickets": total_tickets,
        "total_open": total_open,
        "total_closed": total_closed,
        "global_avg_resolution_hours": global_avg_resolution_hours,
        "total_time_spent_hours": total_time_spent_hours,
    }


def get_client_details(project_key: str, oldest_limit: int = 10) -> Dict[str, Any]:
    db_path = get_sqlite_path()

    if not _issues_table_exists(db_path):
        return {
            "project_key": project_key,
            "total_issues": 0,
            "open_issues": 0,
            "closed_issues": 0,
            "time_spent_hours": 0.0,
            "avg_resolution_hours": None,
            "resolved_issues_with_dates": 0,
            "status_breakdown": [],
            "priority_breakdown": [],
            "oldest_open_tickets": [],
        }

    now = datetime.now(timezone.utc)

    with _connect_sqlite(db_path) as conn:
        rows = conn.execute(
            """
            SELECT issue_key, project_key, status, priority, assignee, created, updated, resolved, time_spent_seconds
            FROM issues
            WHERE COALESCE(NULLIF(TRIM(project_key), ''), 'UNKNOWN') = ?
            ORDER BY created DESC
            """,
            (project_key,),
        ).fetchall()

    total_issues = 0
    open_issues = 0
    closed_issues = 0
    time_spent_seconds = 0
    resolved_issues_with_dates = 0
    resolution_total_hours = 0.0

    status_breakdown: Dict[str, int] = {}
    priority_breakdown: Dict[str, int] = {}
    oldest_open_tickets: List[Dict[str, Any]] = []

    for r in rows:
        total_issues += 1

        status = r["status"]
        priority = r["priority"] or "Unknown"

        status_label = status or "Unknown"
        status_breakdown[status_label] = status_breakdown.get(status_label, 0) + 1
        priority_breakdown[str(priority)] = priority_breakdown.get(str(priority), 0) + 1

        if _is_closed_status(status):
            closed_issues += 1
        else:
            open_issues += 1
            dt_created = _parse_jira_dt(r["created"])
            if dt_created is not None:
                oldest_open_tickets.append(
                    {
                        "key": str(r["issue_key"]),
                        "status": status,
                        "priority": r["priority"],
                        "assignee": _assignee_label(r["assignee"]),
                        "created": r["created"],
                        "updated": r["updated"],
                        "age_hours": _age_hours(now, dt_created),
                    }
                )

        time_spent_seconds += int(r["time_spent_seconds"] or 0)

        dt_created = _parse_jira_dt(r["created"])
        dt_resolved = _parse_jira_dt(r["resolved"])
        if dt_created and dt_resolved:
            resolved_issues_with_dates += 1
            resolution_total_hours += _duration_hours(dt_created, dt_resolved)

    oldest_open_tickets.sort(key=lambda item: item["age_hours"], reverse=True)

    return {
        "project_key": project_key,
        "total_issues": total_issues,
        "open_issues": open_issues,
        "closed_issues": closed_issues,
        "time_spent_hours": time_spent_seconds / 3600.0,
        "avg_resolution_hours": (
            resolution_total_hours / resolved_issues_with_dates
            if resolved_issues_with_dates > 0
            else None
        ),
        "resolved_issues_with_dates": resolved_issues_with_dates,
        "status_breakdown": [
            {"label": k, "count": v}
            for k, v in sorted(
                status_breakdown.items(), key=lambda item: (-item[1], item[0].lower())
            )
        ],
        "priority_breakdown": [
            {"label": k, "count": v}
            for k, v in sorted(
                priority_breakdown.items(), key=lambda item: (-item[1], item[0].lower())
            )
        ],
        "oldest_open_tickets": oldest_open_tickets[:oldest_limit],
    }


def get_client_summary(
    project_key: str,
    days: int = 30,
    date_field: str = "updated",
) -> Dict[str, Any]:
    db_path = get_sqlite_path()
    date_field = _normalize_date_field(date_field)

    if not _issues_table_exists(db_path):
        coverage = _empty_coverage(days)
        return {
            "project_key": project_key,
            "total_tickets": 0,
            "open_tickets": 0,
            "closed_tickets": 0,
            "close_rate_percent": 0.0,
            "avg_resolution_hours": None,
            "avg_hours_per_ticket": 0.0,
            "created_in_period": 0,
            "updated_in_period": 0,
            "resolved_in_period": 0,
            "oldest_open_hours": None,
            "high_critical_open": 0,
            "status_breakdown": [],
            "priority_breakdown": [],
            "total_time_spent_hours": 0.0,
            "days": coverage["effective_days"],
            "date_field": date_field,
            "data_start_date": coverage["data_start_date"],
            "data_end_date": coverage["data_end_date"],
            "max_available_days": coverage["max_available_days"],
            "allowed_periods": coverage["allowed_periods"],
            "period_is_limited": coverage["period_is_limited"],
            "coverage_notice": coverage["coverage_notice"],
        }

    now = datetime.now(timezone.utc)

    with _connect_sqlite(db_path) as conn:
        rows = conn.execute(
            """
            SELECT issue_key, status, priority, assignee, created, updated, resolved, time_spent_seconds
            FROM issues
            WHERE COALESCE(NULLIF(TRIM(project_key), ''), 'UNKNOWN') = ?
            """,
            (project_key,),
        ).fetchall()

    coverage = _compute_data_coverage(rows, days)
    effective_days = coverage["effective_days"]
    cutoff = None if days == 0 else now - timedelta(days=effective_days)

    total_tickets = 0
    open_tickets = 0
    closed_tickets = 0
    created_in_period = 0
    updated_in_period = 0
    resolved_in_period = 0
    high_critical_open = 0
    time_spent_seconds = 0
    oldest_open_hours: Optional[float] = None

    status_breakdown: Dict[str, int] = {}
    priority_breakdown: Dict[str, int] = {}

    resolution_total_hours = 0.0
    resolved_issues_with_dates = 0

    for r in rows:
        total_tickets += 1

        status = r["status"]
        priority = r["priority"]

        dt_created = _parse_jira_dt(r["created"])
        dt_updated = _parse_jira_dt(r["updated"])
        dt_resolved = _parse_jira_dt(r["resolved"])

        filter_dt = {
            "created": dt_created,
            "updated": dt_updated,
            "resolved": dt_resolved,
        }[date_field]

        in_period = filter_dt is not None and (cutoff is None or filter_dt >= cutoff)

        if in_period:
            family = _map_status_to_family(status)
            status_breakdown[family] = status_breakdown.get(family, 0) + 1

            priority_label = priority or "Unknown"
            priority_breakdown[priority_label] = (
                priority_breakdown.get(priority_label, 0) + 1
            )

        if _is_closed_status(status):
            closed_tickets += 1
        else:
            open_tickets += 1
            if _is_high_or_critical(priority):
                high_critical_open += 1

            if dt_created:
                age = float(_age_hours(now, dt_created))
                if oldest_open_hours is None or age > oldest_open_hours:
                    oldest_open_hours = age

        if dt_created and (cutoff is None or dt_created >= cutoff):
            created_in_period += 1

        if dt_updated and (cutoff is None or dt_updated >= cutoff):
            updated_in_period += 1

        if dt_resolved and (cutoff is None or dt_resolved >= cutoff):
            resolved_in_period += 1

        if dt_created and dt_resolved:
            resolved_issues_with_dates += 1
            resolution_total_hours += _duration_hours(dt_created, dt_resolved)

        time_spent_seconds += int(r["time_spent_seconds"] or 0)

    close_rate_percent = (
        (closed_tickets / total_tickets) * 100.0 if total_tickets > 0 else 0.0
    )
    avg_resolution_hours = (
        resolution_total_hours / resolved_issues_with_dates
        if resolved_issues_with_dates > 0
        else None
    )
    total_time_spent_hours = time_spent_seconds / 3600.0
    avg_hours_per_ticket = (
        total_time_spent_hours / total_tickets if total_tickets > 0 else 0.0
    )

    return {
        "project_key": project_key,
        "total_tickets": total_tickets,
        "open_tickets": open_tickets,
        "closed_tickets": closed_tickets,
        "close_rate_percent": round(close_rate_percent, 1),
        "avg_resolution_hours": avg_resolution_hours,
        "avg_hours_per_ticket": avg_hours_per_ticket,
        "created_in_period": created_in_period,
        "updated_in_period": updated_in_period,
        "resolved_in_period": resolved_in_period,
        "oldest_open_hours": oldest_open_hours,
        "high_critical_open": high_critical_open,
        "status_breakdown": [
            {"label": k, "count": v}
            for k, v in sorted(
                status_breakdown.items(), key=lambda item: (-item[1], item[0].lower())
            )
        ],
        "priority_breakdown": [
            {"label": k, "count": v}
            for k, v in sorted(
                priority_breakdown.items(), key=lambda item: (-item[1], item[0].lower())
            )
        ],
        "total_time_spent_hours": total_time_spent_hours,
        "days": effective_days,
        "date_field": date_field,
        "data_start_date": coverage["data_start_date"],
        "data_end_date": coverage["data_end_date"],
        "max_available_days": coverage["max_available_days"],
        "allowed_periods": coverage["allowed_periods"],
        "period_is_limited": coverage["period_is_limited"],
        "coverage_notice": coverage["coverage_notice"],
    }


def get_client_timeline(
    project_key: str,
    days: int = 30,
    date_field: str = "updated",
) -> Dict[str, Any]:
    db_path = get_sqlite_path()
    date_field = _normalize_date_field(date_field)

    if not _issues_table_exists(db_path):
        return {
            "project_key": project_key,
            "days": 7,
            "date_field": date_field,
            "points": [],
        }

    with _connect_sqlite(db_path) as conn:
        rows = conn.execute(
            """
            SELECT created, updated, resolved
            FROM issues
            WHERE COALESCE(NULLIF(TRIM(project_key), ''), 'UNKNOWN') = ?
            """,
            (project_key,),
        ).fetchall()

    coverage = _compute_data_coverage(rows, days)
    effective_days = coverage["effective_days"]

    now = datetime.now(timezone.utc)
    if days == 0:
        if coverage["data_start_date"]:
            start_date = datetime.fromisoformat(coverage["data_start_date"]).date()
        else:
            start_date = now.date()
    else:
        start_date = (now - timedelta(days=effective_days - 1)).date()

    created_map: Dict[str, int] = {}
    resolved_map: Dict[str, int] = {}

    for r in rows:
        dt_created = _parse_jira_dt(r["created"])
        dt_updated = _parse_jira_dt(r["updated"])
        dt_resolved = _parse_jira_dt(r["resolved"])

        base_dt = {
            "created": dt_created,
            "updated": dt_updated,
            "resolved": dt_resolved,
        }[date_field]

        if base_dt and base_dt.date() >= start_date:
            key = base_dt.date().isoformat()
            created_map[key] = created_map.get(key, 0) + 1

        if dt_resolved and dt_resolved.date() >= start_date:
            key = dt_resolved.date().isoformat()
            resolved_map[key] = resolved_map.get(key, 0) + 1

    points: List[Dict[str, Any]] = []
    current = start_date
    end = now.date()

    while current <= end:
        key = current.isoformat()
        points.append(
            {
                "period": key,
                "created": created_map.get(key, 0),
                "resolved": resolved_map.get(key, 0),
            }
        )
        current += timedelta(days=1)

    return {
        "project_key": project_key,
        "days": effective_days,
        "date_field": date_field,
        "points": points,
    }


def get_client_backlog(project_key: str) -> Dict[str, Any]:
    db_path = get_sqlite_path()

    empty = {
        "project_key": project_key,
        "buckets": [
            {"label": "0-7d", "count": 0},
            {"label": "8-30d", "count": 0},
            {"label": "31-90d", "count": 0},
            {"label": "90+d", "count": 0},
        ],
    }

    if not _issues_table_exists(db_path):
        return empty

    now = datetime.now(timezone.utc)
    buckets = {
        "0-7d": 0,
        "8-30d": 0,
        "31-90d": 0,
        "90+d": 0,
    }

    with _connect_sqlite(db_path) as conn:
        rows = conn.execute(
            """
            SELECT status, created
            FROM issues
            WHERE COALESCE(NULLIF(TRIM(project_key), ''), 'UNKNOWN') = ?
            """,
            (project_key,),
        ).fetchall()

    for r in rows:
        if _is_closed_status(r["status"]):
            continue

        dt_created = _parse_jira_dt(r["created"])
        if not dt_created:
            continue

        age_hours = _age_hours(now, dt_created)
        age_days = age_hours / 24.0

        if age_days <= 7:
            buckets["0-7d"] += 1
        elif age_days <= 30:
            buckets["8-30d"] += 1
        elif age_days <= 90:
            buckets["31-90d"] += 1
        else:
            buckets["90+d"] += 1

    return {
        "project_key": project_key,
        "buckets": [{"label": label, "count": count} for label, count in buckets.items()],
    }


def get_client_activity(
    project_key: str,
    oldest_limit: int = 10,
    recent_limit: int = 10,
) -> Dict[str, Any]:
    db_path = get_sqlite_path()

    if not _issues_table_exists(db_path):
        return {
            "project_key": project_key,
            "oldest_open_tickets": [],
            "recent_created": [],
            "recent_resolved": [],
        }

    now = datetime.now(timezone.utc)

    with _connect_sqlite(db_path) as conn:
        rows = conn.execute(
            """
            SELECT issue_key, status, priority, assignee, created, updated, resolved
            FROM issues
            WHERE COALESCE(NULLIF(TRIM(project_key), ''), 'UNKNOWN') = ?
            """,
            (project_key,),
        ).fetchall()

    oldest_open_tickets: List[Dict[str, Any]] = []
    recent_created: List[Dict[str, Any]] = []
    recent_resolved: List[Dict[str, Any]] = []

    for r in rows:
        issue = {
            "key": str(r["issue_key"]),
            "status": r["status"],
            "priority": r["priority"],
            "assignee": _assignee_label(r["assignee"]),
            "created": r["created"],
            "resolved": r["resolved"],
        }

        dt_created = _parse_jira_dt(r["created"])
        dt_resolved = _parse_jira_dt(r["resolved"])

        if not _is_closed_status(r["status"]) and dt_created:
            oldest_open_tickets.append(
                {
                    "key": issue["key"],
                    "status": issue["status"],
                    "priority": issue["priority"],
                    "assignee": issue["assignee"],
                    "created": r["created"],
                    "updated": r["updated"],
                    "age_hours": float(_age_hours(now, dt_created)),
                }
            )

        if dt_created:
            recent_created.append({**issue, "_sort_dt": dt_created})

        if dt_resolved:
            recent_resolved.append({**issue, "_sort_dt": dt_resolved})

    oldest_open_tickets.sort(key=lambda item: item["age_hours"], reverse=True)
    recent_created.sort(key=lambda item: item["_sort_dt"], reverse=True)
    recent_resolved.sort(key=lambda item: item["_sort_dt"], reverse=True)

    for item in recent_created:
        item.pop("_sort_dt", None)
    for item in recent_resolved:
        item.pop("_sort_dt", None)

    return {
        "project_key": project_key,
        "oldest_open_tickets": oldest_open_tickets[:oldest_limit],
        "recent_created": recent_created[:recent_limit],
        "recent_resolved": recent_resolved[:recent_limit],
    }