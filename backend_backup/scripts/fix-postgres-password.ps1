# PowerShell script to fix PostgreSQL password authentication
# This script temporarily enables trust authentication, resets password, then restores security

$ErrorActionPreference = "Stop"

Write-Host "=== PostgreSQL Password Fix Script ===" -ForegroundColor Cyan
Write-Host ""

# PostgreSQL 15 configuration (port 5432)
$pgDataDir = "C:\Program Files\PostgreSQL\15\data"
$pgHbaPath = Join-Path $pgDataDir "pg_hba.conf"
$pgHbaBackup = "$pgHbaPath.backup"

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  This script requires administrator privileges." -ForegroundColor Yellow
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative: Manual fix" -ForegroundColor Cyan
    Write-Host "1. Open pgAdmin"
    Write-Host "2. Connect to PostgreSQL server"
    Write-Host "3. Run: ALTER USER postgres WITH PASSWORD 'postgres';"
    exit 1
}

if (-not (Test-Path $pgHbaPath)) {
    Write-Host "❌ PostgreSQL configuration not found at: $pgHbaPath" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Step 1: Backing up pg_hba.conf..." -ForegroundColor Yellow
Copy-Item $pgHbaPath $pgHbaBackup -Force
Write-Host "✅ Backup created: $pgHbaBackup" -ForegroundColor Green

Write-Host "`n📋 Step 2: Temporarily enabling trust authentication for localhost..." -ForegroundColor Yellow
$pgHbaContent = Get-Content $pgHbaPath
$newContent = @()

foreach ($line in $pgHbaContent) {
    if ($line -match "^\s*host\s+all\s+all\s+127\.0\.0\.1/32" -and $line -notmatch "#") {
        # Comment out the existing line and add trust version
        $newContent += "# Temporarily changed to trust (will be restored):"
        $newContent += "# $line"
        $newContent += "host    all             all             127.0.0.1/32            trust"
        Write-Host "   Modified: $line" -ForegroundColor Gray
    } elseif ($line -match "^\s*host\s+all\s+all\s+::1/128" -and $line -notmatch "#") {
        $newContent += "# Temporarily changed to trust (will be restored):"
        $newContent += "# $line"
        $newContent += "host    all             all             ::1/128                 trust"
        Write-Host "   Modified: $line" -ForegroundColor Gray
    } else {
        $newContent += $line
    }
}

Set-Content -Path $pgHbaPath -Value $newContent
Write-Host "✅ pg_hba.conf updated" -ForegroundColor Green

Write-Host "`n📋 Step 3: Reloading PostgreSQL configuration..." -ForegroundColor Yellow
$service = Get-Service -Name "postgresql-x64-15"
if ($service.Status -eq "Running") {
    # Reload configuration (doesn't require full restart)
    $result = & "C:\Program Files\PostgreSQL\15\bin\pg_ctl.exe" reload -D $pgDataDir 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Configuration reloaded" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } else {
        Write-Host "⚠️  Could not reload, restarting service..." -ForegroundColor Yellow
        Restart-Service -Name "postgresql-x64-15" -Force
        Start-Sleep -Seconds 5
    }
} else {
    Write-Host "⚠️  PostgreSQL service not running, starting it..." -ForegroundColor Yellow
    Start-Service -Name "postgresql-x64-15"
    Start-Sleep -Seconds 5
}

Write-Host "`n📋 Step 4: Resetting postgres user password..." -ForegroundColor Yellow
$env:PGPASSWORD = $null  # Clear any existing password
$resetQuery = "ALTER USER postgres WITH PASSWORD 'postgres';"
$result = & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -h localhost -p 5432 -d postgres -c $resetQuery 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Password reset successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Password reset failed:" -ForegroundColor Red
    Write-Host $result
    Write-Host "`nRestoring pg_hba.conf..." -ForegroundColor Yellow
    Copy-Item $pgHbaBackup $pgHbaPath -Force
    exit 1
}

Write-Host "`n📋 Step 5: Restoring original pg_hba.conf..." -ForegroundColor Yellow
Copy-Item $pgHbaBackup $pgHbaPath -Force
Write-Host "✅ Original configuration restored" -ForegroundColor Green

Write-Host "`n📋 Step 6: Reloading PostgreSQL configuration again..." -ForegroundColor Yellow
& "C:\Program Files\PostgreSQL\15\bin\pg_ctl.exe" reload -D $pgDataDir 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Restart-Service -Name "postgresql-x64-15" -Force
    Start-Sleep -Seconds 3
}
Write-Host "✅ Configuration reloaded" -ForegroundColor Green

Write-Host "`n📋 Step 7: Testing connection..." -ForegroundColor Yellow
$env:PGPASSWORD = "postgres"
$testResult = & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -h localhost -p 5432 -d postgres -c "SELECT version();" 2>&1
$env:PGPASSWORD = $null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Connection test successful!" -ForegroundColor Green
    Write-Host "`n🎉 PostgreSQL password has been successfully reset to 'postgres'!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "1. Run: npm run setup:db" -ForegroundColor Yellow
    Write-Host "2. Run: npm run dev" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  Connection test failed, but password may have been reset." -ForegroundColor Yellow
    Write-Host "Try running: npm run setup:db" -ForegroundColor Yellow
}

# Clean up backup
if (Test-Path $pgHbaBackup) {
    Remove-Item $pgHbaBackup -Force
}

