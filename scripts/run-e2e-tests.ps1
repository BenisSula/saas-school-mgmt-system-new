# E2E Test Execution Script
# Runs Playwright E2E tests for admin flows
# Usage: .\scripts\run-e2e-tests.ps1 [options]

param(
    [switch]$All,
    [switch]$AdminFlows,
    [switch]$UI,
    [switch]$Headed,
    [switch]$Verbose,
    [string]$TestPattern = ""
)

$ErrorActionPreference = "Continue"

Write-Host "=== E2E Test Execution Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "frontend/playwright.config.ts")) {
    Write-Host "❌ Error: Must run from project root directory" -ForegroundColor Red
    Write-Host "   Current directory: $(Get-Location)" -ForegroundColor Yellow
    Write-Host "   Expected: C:\sumano\saas-school-mgmt-system" -ForegroundColor Yellow
    exit 1
}

# Check if backend is running
Write-Host "Checking backend status..." -ForegroundColor Yellow
try {
    $backendResponse = Invoke-WebRequest -Uri "http://127.0.0.1:3001/health" -Method GET -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✅ Backend is running (Status: $($backendResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backend is NOT running or not accessible" -ForegroundColor Yellow
    Write-Host "   Tests may skip if backend is required" -ForegroundColor Yellow
    Write-Host "   Start backend with: cd backend && npm run dev" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Aborted by user" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Navigate to frontend directory
Push-Location frontend

try {
    # Build test command
    $testCommand = "npx playwright test"
    $testArgs = @()

    # Determine which tests to run
    if ($AdminFlows -or (-not $All -and $TestPattern -eq "")) {
        $testArgs += "e2e/admin-flows.spec.ts"
        Write-Host "Running: Admin Flows E2E Tests" -ForegroundColor Cyan
    } elseif ($All) {
        Write-Host "Running: All E2E Tests" -ForegroundColor Cyan
    } elseif ($TestPattern -ne "") {
        $testArgs += $TestPattern
        Write-Host "Running: Tests matching pattern '$TestPattern'" -ForegroundColor Cyan
    } else {
        $testArgs += "e2e/admin-flows.spec.ts"
        Write-Host "Running: Admin Flows E2E Tests (default)" -ForegroundColor Cyan
    }

    # Add UI mode
    if ($UI) {
        $testArgs += "--ui"
        Write-Host "Mode: Interactive UI" -ForegroundColor Cyan
    } elseif ($Headed) {
        $testArgs += "--headed"
        Write-Host "Mode: Headed (visible browser)" -ForegroundColor Cyan
    } else {
        Write-Host "Mode: Headless" -ForegroundColor Cyan
    }

    # Add verbose flag
    if ($Verbose) {
        $testArgs += "--reporter=list"
    }

    Write-Host ""
    Write-Host "Command: $testCommand $($testArgs -join ' ')" -ForegroundColor Gray
    Write-Host ""

    # Run tests
    & npx playwright test @testArgs

    $exitCode = $LASTEXITCODE

    Write-Host ""
    if ($exitCode -eq 0) {
        Write-Host "✅ Tests completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Tests failed or had errors (exit code: $exitCode)" -ForegroundColor Red
        Write-Host ""
        Write-Host "View detailed report:" -ForegroundColor Yellow
        Write-Host "  npx playwright show-report" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Test results location:" -ForegroundColor Yellow
        Write-Host "  - HTML Report: frontend/playwright-report/index.html" -ForegroundColor Gray
        Write-Host "  - JUnit XML: frontend/test-results/junit.xml" -ForegroundColor Gray
        Write-Host "  - JSON Report: frontend/test-results/results.json" -ForegroundColor Gray
    }

    exit $exitCode

} catch {
    Write-Host ""
    Write-Host "❌ Error running tests: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Gray
    exit 1
} finally {
    Pop-Location
}

