from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class ClientOverviewItem(BaseModel):
    project_key: str
    total_issues: int
    open_issues: int
    closed_issues: int
    time_spent_hours: float
    avg_hours_per_ticket: float
    avg_resolution_hours: Optional[float]
    resolved_issues_with_dates: int


class ClientOverviewResponse(BaseModel):
    clients: List[ClientOverviewItem]
    total_clients: int
    total_tickets: int
    total_open: int
    total_closed: int
    global_avg_resolution_hours: Optional[float]
    total_time_spent_hours: float


class StatusBreakdownItem(BaseModel):
    label: str
    count: int


class PriorityBreakdownItem(BaseModel):
    label: str
    count: int


class OldestOpenTicketItem(BaseModel):
    key: str
    status: Optional[str]
    priority: Optional[str]
    assignee: str
    created: Optional[str]
    updated: Optional[str]
    age_hours: float


class ClientDetailsResponse(BaseModel):
    project_key: str
    total_issues: int
    open_issues: int
    closed_issues: int
    time_spent_hours: float
    avg_resolution_hours: Optional[float]
    resolved_issues_with_dates: int
    status_breakdown: List[StatusBreakdownItem]
    priority_breakdown: List[PriorityBreakdownItem]
    oldest_open_tickets: List[OldestOpenTicketItem]


class ClientSummaryResponse(BaseModel):
    project_key: str
    total_tickets: int
    open_tickets: int
    closed_tickets: int
    close_rate_percent: float
    avg_resolution_hours: Optional[float]
    avg_hours_per_ticket: float
    created_in_period: int
    updated_in_period: int
    resolved_in_period: int
    oldest_open_hours: Optional[float]
    high_critical_open: int
    status_breakdown: List[StatusBreakdownItem]
    priority_breakdown: List[PriorityBreakdownItem]
    total_time_spent_hours: float
    days: int
    date_field: str

    data_start_date: Optional[str]
    data_end_date: Optional[str]
    max_available_days: int
    allowed_periods: List[int]
    period_is_limited: bool
    coverage_notice: Optional[str]


class TimelinePoint(BaseModel):
    period: str
    created: int
    resolved: int


class ClientTimelineResponse(BaseModel):
    project_key: str
    days: int
    date_field: str
    points: List[TimelinePoint]


class BacklogBucketItem(BaseModel):
    label: str
    count: int


class ClientBacklogResponse(BaseModel):
    project_key: str
    buckets: List[BacklogBucketItem]


class RecentActivityItem(BaseModel):
    key: str
    status: Optional[str]
    priority: Optional[str]
    assignee: str
    created: Optional[str]
    resolved: Optional[str]


class ClientActivityResponse(BaseModel):
    project_key: str
    oldest_open_tickets: List[OldestOpenTicketItem]
    recent_created: List[RecentActivityItem]
    recent_resolved: List[RecentActivityItem]