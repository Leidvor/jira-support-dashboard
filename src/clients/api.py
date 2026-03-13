from __future__ import annotations

import os
import sys

from fastapi import APIRouter, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from .schemas import (
    ClientActivityResponse,
    ClientBacklogResponse,
    ClientDetailsResponse,
    ClientOverviewResponse,
    ClientSummaryResponse,
    ClientTimelineResponse,
)
from .service import (
    get_client_activity,
    get_client_backlog,
    get_client_details,
    get_client_summary,
    get_client_timeline,
    get_clients_overview,
)

if getattr(sys, "frozen", False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )

TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
templates = Jinja2Templates(directory=TEMPLATES_DIR)

router = APIRouter(tags=["clients"])


@router.get("/clients", response_class=HTMLResponse)
def clients_page(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("clients.html", {"request": request})


@router.get("/clients/{project_key}", response_class=HTMLResponse)
def client_detail_page(request: Request, project_key: str) -> HTMLResponse:
    return templates.TemplateResponse(
        "client_detail.html",
        {
            "request": request,
            "project_key": project_key,
        },
    )


@router.get("/stats/clients/overview", response_model=ClientOverviewResponse)
def stats_clients_overview() -> ClientOverviewResponse:
    return ClientOverviewResponse(**get_clients_overview())


@router.get("/stats/clients/details/{project_key}", response_model=ClientDetailsResponse)
def stats_client_details(
    project_key: str,
    oldest_limit: int = Query(10, ge=1, le=50),
) -> ClientDetailsResponse:
    return ClientDetailsResponse(
        **get_client_details(project_key, oldest_limit=oldest_limit)
    )


@router.get("/stats/clients/summary/{project_key}", response_model=ClientSummaryResponse)
def stats_client_summary(
    project_key: str,
    days: int = Query(30, ge=0, le=3650),
    date_field: str = Query("updated", pattern="^(created|updated|resolved)$"),
) -> ClientSummaryResponse:
    return ClientSummaryResponse(
        **get_client_summary(project_key, days=days, date_field=date_field)
    )


@router.get("/stats/clients/timeline/{project_key}", response_model=ClientTimelineResponse)
def stats_client_timeline(
    project_key: str,
    days: int = Query(30, ge=0, le=3650),
    date_field: str = Query("updated", pattern="^(created|updated|resolved)$"),
) -> ClientTimelineResponse:
    return ClientTimelineResponse(
        **get_client_timeline(project_key, days=days, date_field=date_field)
    )


@router.get("/stats/clients/backlog/{project_key}", response_model=ClientBacklogResponse)
def stats_client_backlog(project_key: str) -> ClientBacklogResponse:
    return ClientBacklogResponse(**get_client_backlog(project_key))


@router.get("/stats/clients/activity/{project_key}", response_model=ClientActivityResponse)
def stats_client_activity(
    project_key: str,
    oldest_limit: int = Query(10, ge=1, le=50),
    recent_limit: int = Query(10, ge=1, le=50),
) -> ClientActivityResponse:
    return ClientActivityResponse(
        **get_client_activity(
            project_key,
            oldest_limit=oldest_limit,
            recent_limit=recent_limit,
        )
    )