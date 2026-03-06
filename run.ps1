# run.ps1 - Jira Support Dashboard launcher (Windows)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
if ($PSStyle -and ($PSStyle.PSObject.Properties.Name -contains "OutputRendering")) {
  $PSStyle.OutputRendering = "PlainText"
}

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

if (!(Test-Path ".\.venv\Scripts\Activate.ps1")) {
  Write-Host "Virtualenv not found. Create it with: python -m venv .venv" -ForegroundColor Red
  exit 1
}
. .\.venv\Scripts\Activate.ps1

if (!(Test-Path ".\.env")) {
  if (Test-Path ".\.env.example") {
    Copy-Item ".\.env.example" ".\.env"
    Write-Host "Created .env from .env.example. Please fill your Jira credentials, then run the script again." -ForegroundColor Yellow
    exit 1
  }

  Write-Host ".env not found and .env.example is missing." -ForegroundColor Red
  exit 1
}

python -m uvicorn src.api:app --host 0.0.0.0 --port 6441