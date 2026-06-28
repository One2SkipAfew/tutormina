# ============================================
# TutorMina — Local Dev Startup Script
# ============================================
# Run from the project root: .\dev-start.ps1
# This starts all 3 services for local development.
# Prerequisites: Docker running, npm deps installed, Python venv created.

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TutorMina — Starting Local Dev Stack" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Docker is running
Write-Host "[1/4] Checking Docker..." -ForegroundColor Yellow
$dockerCheck = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}
Write-Host "  Docker is running." -ForegroundColor Green

# 2. Start Supabase (local DB)
Write-Host "[2/4] Starting local Supabase..." -ForegroundColor Yellow
$supabaseJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npx supabase start 2>&1
}
Write-Host "  Supabase starting in background (may take a minute on first run)..." -ForegroundColor Green

# 3. Start AI API (FastAPI)
Write-Host "[3/4] Starting AI API (FastAPI)..." -ForegroundColor Yellow
$apiProcess = Start-Process -FilePath ".\ai-api\venv\Scripts\python.exe" `
    -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload" `
    -WorkingDirectory ".\ai-api" `
    -PassThru -NoNewWindow
Write-Host "  AI API running at http://127.0.0.1:8000" -ForegroundColor Green

# 4. Start Frontend (Vite)
Write-Host "[4/4] Starting Frontend (Vite)..." -ForegroundColor Yellow
Set-Location ".\frontend"
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  All services starting!" -ForegroundColor Cyan
Write-Host "" 
Write-Host "  Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "  AI API:    http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  Supabase:  http://127.0.0.1:55321" -ForegroundColor White
Write-Host "  Studio:    http://127.0.0.1:55323" -ForegroundColor White
Write-Host "  InBucket:  http://127.0.0.1:55324 (email testing)" -ForegroundColor White
Write-Host "" 
Write-Host "  Press Ctrl+C to stop the frontend." -ForegroundColor DarkGray
Write-Host "  Run 'npx supabase stop' to stop the DB." -ForegroundColor DarkGray
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

npm run dev
