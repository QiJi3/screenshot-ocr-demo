# Screenshot OCR Demo - One-click startup
# Usage: .\start.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── 1. Check Python venv ──────────────────────────────────────────────────────
$venvPython = Join-Path $root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "[setup] Creating Python virtual environment..." -ForegroundColor Yellow
    Push-Location (Join-Path $root "backend")
    python -m venv .venv
    & ".venv\Scripts\pip.exe" install -r requirements.txt -q
    Pop-Location
    Write-Host "[setup] Python environment ready." -ForegroundColor Green
}

# ── 2. Build frontend if dist is missing ─────────────────────────────────────
$distIndex = Join-Path $root "frontend\dist\index.html"
if (-not (Test-Path $distIndex)) {
    Write-Host "[build] Building frontend..." -ForegroundColor Yellow
    Push-Location (Join-Path $root "frontend")
    pnpm build
    Pop-Location
    Write-Host "[build] Frontend ready." -ForegroundColor Green
}

# ── 3. Kill any leftover process on port 8000 ────────────────────────────────
$listening = netstat -ano | Select-String ":8000\s+\S+\s+LISTENING"
foreach ($line in $listening) {
    $pid2 = ($line -split "\s+")[-1]
    if ($pid2 -match "^\d+$" -and [int]$pid2 -gt 0) {
        Write-Host "[clean] Killing PID $pid2 on port 8000" -ForegroundColor DarkGray
        Stop-Process -Id ([int]$pid2) -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

# ── 4. Launch Electron ────────────────────────────────────────────────────────
Write-Host "[start] Launching Electron..." -ForegroundColor Cyan
Push-Location (Join-Path $root "electron")
$env:NODE_OPTIONS = ''
npm start
Pop-Location
