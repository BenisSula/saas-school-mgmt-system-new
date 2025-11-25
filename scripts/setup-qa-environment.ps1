# Setup script for QA testing environment (PowerShell)
# This script ensures the backend is ready for testing

Write-Host "🔧 Setting up QA Testing Environment..." -ForegroundColor Cyan

# Check if backend is running
Write-Host "📡 Checking if backend is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backend is not running. Please start it with: npm run dev --prefix backend" -ForegroundColor Red
    Write-Host "   Starting backend in background..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev"
    Write-Host "   Waiting 10 seconds for backend to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

# Seed demo accounts
Write-Host "🌱 Seeding demo accounts..." -ForegroundColor Yellow
Set-Location backend
npm run demo:seed
Set-Location ..

Write-Host "✅ QA environment setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "You can now run tests with: npm run qa:test" -ForegroundColor Cyan

