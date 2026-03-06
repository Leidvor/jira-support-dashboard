from __future__ import annotations

from typing import Any, Dict, Iterator, List
import requests


class JiraClient:
    """
    Minimal Jira Cloud REST client for searching issues with pagination.
    Uses Basic Auth with email + API token.
    """

    def __init__(self, base_url: str, email: str, api_token: str, timeout_s: int = 30):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.auth = (email, api_token)
        self.session.headers.update(
            {
                "Accept": "application/json",
                "Content-Type": "application/json",
            }
        )
        self.timeout_s = timeout_s

    def search_issues(
        self,
        jql: str,
        fields: List[str],
        page_size: int = 100,
    ) -> Iterator[Dict[str, Any]]:
        """
        Yields raw Jira issues (dicts) matching JQL, handling pagination.

        Migration note:
        - Jira Cloud removed POST /rest/api/3/search (HTTP 410).
        - New endpoint is POST /rest/api/3/search/jql with token-based paging (nextPageToken).
        """
        url = f"{self.base_url}/rest/api/3/search/jql"

        next_page_token: str | None = None
        seen_tokens: set[str] = set()

        while True:
            payload: Dict[str, Any] = {
                "jql": jql,
                "maxResults": page_size,
                "fields": fields,
            }
            if next_page_token:
                payload["nextPageToken"] = next_page_token

            resp = self.session.post(url, json=payload, timeout=self.timeout_s)

            if resp.status_code == 401:
                raise RuntimeError("Unauthorized (401). Check JIRA_EMAIL / JIRA_API_TOKEN.")
            if resp.status_code == 403:
                raise RuntimeError("Forbidden (403). Token/user lacks permissions for one or more projects.")
            if resp.status_code >= 400:
                raise RuntimeError(f"Jira API error {resp.status_code}: {resp.text}")

            data = resp.json()

            issues = data.get("issues", []) or []
            for issue in issues:
                yield issue

            # Enhanced search paging: stop when isLast=true.
            is_last = data.get("isLast")
            next_page_token = data.get("nextPageToken")

            if is_last is True:
                break

            # Defensive: if Jira doesn't provide a nextPageToken and isn't "isLast",
            # stop to avoid an infinite loop.
            if not next_page_token:
                break

            # Defensive: avoid cycles if the API returns the same token repeatedly.
            if next_page_token in seen_tokens:
                break
            seen_tokens.add(next_page_token)