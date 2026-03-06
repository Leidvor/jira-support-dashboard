from __future__ import annotations

import sys

from .config import load_settings
from .jira_client import JiraClient
from .db import IssuesRepository
from .sync import run_sync


def main() -> int:
    settings = load_settings()

    jira = JiraClient(
        base_url=settings.jira_base_url,
        email=settings.jira_email,
        api_token=settings.jira_api_token,
    )
    repo = IssuesRepository(settings.sqlite_path)

    stats = run_sync(
        jira=jira,
        repo=repo,
        jql=settings.jql,
        page_size=settings.page_size,
    )

    print(f"Sync complete. Issues upserted: {stats['upserted']}")
    print(f"SQLite DB: {settings.sqlite_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())