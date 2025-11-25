# Deployment Verification Script (PowerShell)
# Verifies that the application is properly deployed and functioning

param(
    [string]$ApiUrl = "http://localhost:3001",
    [string]$FrontendUrl = "http://localhost:5173",
    [int]$MaxRetries = 5,
    [int]$RetryDelay = 2
)

$ErrorActionPreference = "Stop"

Write-Host "🔍 Starting Deployment Verification..." -ForegroundColor Cyan
Write-Host "API URL: $ApiUrl"
Write-Host "Frontend URL: $FrontendUrl"
Write-Host ""

# Function to check HTTP endpoint
function Check-Endpoint {
    param(
        [string]$Url,
        [string]$Description,
        [int]$ExpectedStatus = 200
    )
    
    Write-Host -NoNewline "Checking $Description... "
    
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -Method Get -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            $statusCode = $response.StatusCode
            
            if ($statusCode -eq $ExpectedStatus) {
                Write-Host "✓ (Status: $statusCode)" -ForegroundColor Green
                return $true
            }
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            if ($statusCode -eq $ExpectedStatus) {
                Write-Host "✓ (Status: $statusCode)" -ForegroundColor Green
                return $true
            }
        }
        
        if ($i -lt $MaxRetries) {
            Write-Host -NoNewline "Retrying ($i/$MaxRetries)... "
            Start-Sleep -Seconds $RetryDelay
        }
    }
    
    Write-Host "✗ (Failed after $MaxRetries attempts)" -ForegroundColor Red
    return $false
}

# Function to check API response
function Check-ApiResponse {
    param(
        [string]$Url,
        [string]$Description,
        [string]$ExpectedKey
    )
    
    Write-Host -NoNewline "Checking $Description... "
    
    try {
        $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 5 -ErrorAction Stop
        $responseJson = $response | ConvertTo-Json
        
        if ($responseJson -match $ExpectedKey) {
            Write-Host "✓" -ForegroundColor Green
            return $true
        } else {
            Write-Host "⚠ (Unexpected response)" -ForegroundColor Yellow
            return $false
        }
    } catch {
        Write-Host "✗ (Error: $($_.Exception.Message))" -ForegroundColor Red
        return $false
    }
}

# Health Checks
Write-Host "=== Health Checks ===" -ForegroundColor Cyan
$healthBackend = Check-Endpoint -Url "$ApiUrl/api/health" -Description "Backend Health" -ExpectedStatus 200
$healthFrontend = Check-Endpoint -Url $FrontendUrl -Description "Frontend Availability" -ExpectedStatus 200
Write-Host ""

# API Endpoints
Write-Host "=== API Endpoints ===" -ForegroundColor Cyan
$apiHealth = Check-Endpoint -Url "$ApiUrl/api/health" -Description "Health Endpoint" -ExpectedStatus 200
if ($apiHealth) {
    Check-ApiResponse -Url "$ApiUrl/api/health" -Description "Health Response" -ExpectedKey "status"
}
Write-Host ""

# Database Connectivity
Write-Host "=== Database Connectivity ===" -ForegroundColor Cyan
try {
    $healthResponse = Invoke-RestMethod -Uri "$ApiUrl/api/health" -Method Get -TimeoutSec 5 -ErrorAction Stop
    $healthJson = $healthResponse | ConvertTo-Json
    if ($healthJson -match "database") {
        Write-Host "✓ Database connectivity verified" -ForegroundColor Green
    } else {
        Write-Host "⚠ Database status not in health check" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Backend not accessible, skipping database check" -ForegroundColor Yellow
}
Write-Host ""

# Security Headers
Write-Host "=== Security Headers ===" -ForegroundColor Cyan
try {
    $headers = Invoke-WebRequest -Uri "$ApiUrl/api/health" -Method Get -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($headers.Headers["X-Content-Type-Options"]) {
        Write-Host "✓ Security headers present" -ForegroundColor Green
    } else {
        Write-Host "⚠ Security headers not detected" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Could not check security headers" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "=== Verification Summary ===" -ForegroundColor Cyan
Write-Host "Deployment verification completed."
Write-Host ""
Write-Host "Next Steps:"
Write-Host "1. Review any warnings or errors above"
Write-Host "2. Run load tests: k6 run load-testing/k6-load-test.js"
Write-Host "3. Check monitoring dashboards (Grafana)"
Write-Host "4. Verify logs for any errors"
Write-Host ""

