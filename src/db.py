from __future__ import annotations

import sqlite3
from typing import Dict, Any


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_key TEXT NOT NULL UNIQUE,
  project_key TEXT,
  issue_type TEXT,
  status TEXT,
  priority TEXT,
  assignee TEXT,
  reporter TEXT,
  created TEXT,
  updated TEXT,
  resolved TEXT,
  time_spent_seconds INTEGER,
  last_sync TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_issues_project_key ON issues(project_key);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_updated ON issues(updated);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
"""


class IssuesRepository:
    def __init__(self, sqlite_path: str):
        self.sqlite_path = sqlite_path

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.sqlite_path)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        return conn

    def _ensure_column(self, conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
        cur = conn.execute(f"PRAGMA table_info({table})")
        cols = {row[1] for row in cur.fetchall()}
        if column not in cols:
            conn.execute(ddl)

    def init_db(self) -> None:
        with self.connect() as conn:
            conn.executescript(SCHEMA_SQL)

            self._ensure_column(
                conn,
                table="issues",
                column="time_spent_seconds",
                ddl="ALTER TABLE issues ADD COLUMN time_spent_seconds INTEGER",
            )

            conn.commit()

    def upsert_issue(self, issue_row: Dict[str, Any]) -> None:
        sql = """
        INSERT INTO issues (
          issue_key, project_key, issue_type, status, priority,
          assignee, reporter, created, updated, resolved,
          time_spent_seconds,
          last_sync
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(issue_key) DO UPDATE SET
          project_key=excluded.project_key,
          issue_type=excluded.issue_type,
          status=excluded.status,
          priority=excluded.priority,
          assignee=excluded.assignee,
          reporter=excluded.reporter,
          created=excluded.created,
          updated=excluded.updated,
          resolved=excluded.resolved,
          time_spent_seconds=excluded.time_spent_seconds,
          last_sync=excluded.last_sync
        ;
        """

        values = (
            issue_row.get("issue_key"),
            issue_row.get("project_key"),
            issue_row.get("issue_type"),
            issue_row.get("status"),
            issue_row.get("priority"),
            issue_row.get("assignee"),
            issue_row.get("reporter"),
            issue_row.get("created"),
            issue_row.get("updated"),
            issue_row.get("resolved"),
            issue_row.get("time_spent_seconds"),
            issue_row.get("last_sync"),
        )

        with self.connect() as conn:
            conn.execute(sql, values)
            conn.commit()

    def clear_issues(self) -> None:
        with self.connect() as conn:
            conn.execute("DELETE FROM issues")
            conn.commit()

    def get_meta(self, key: str) -> str | None:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT value FROM app_meta WHERE key = ?",
                (key,),
            ).fetchone()
            return row[0] if row else None

    def set_meta(self, key: str, value: str) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO app_meta(key, value)
                VALUES(?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (key, value),
            )
            conn.commit()