## Running on Windows (preferred)

Instead of setting environment variables manually every time, the recommended way on Windows is to use a PowerShell launcher script (`run.ps1`) that:

1) sets the execution policy for the current process only  
2) activates the virtual environment  
3) sets required environment variables  
4) starts the FastAPI server with Uvicorn  

This approach is **preferred** on Windows because it makes runs reproducible and avoids manual setup.

### Example `run.ps1`

Create a `run.ps1` file at the project root:

```powershell
# run.ps1 - Windows launcher (preferred)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

# Move to the script directory (project root)
Set-Location -Path $PSScriptRoot

# Activate venv
if (!(Test-Path ".\.venv\Scripts\Activate.ps1")) {
  Write-Error "Virtual environment not found. Run: python -m venv .venv"
  exit 1
}
.\.venv\Scripts\Activate.ps1

# ---- Required environment variables ----
$env:JIRA_BASE_URL  = "https://your-domain.atlassian.net"
$env:JIRA_EMAIL     = "you@company.com"
$env:JIRA_API_TOKEN = "your_api_token"
$env:JIRA_JQL       = "updated >= -30d ORDER BY updated ASC"

# ---- Optional tuning ----
$env:JIRA_PAGE_SIZE = "100"
$env:SQLITE_PATH    = ".\jira_issues.db"

# Run API
uvicorn src.api:app --host 127.0.0.1 --port 8000