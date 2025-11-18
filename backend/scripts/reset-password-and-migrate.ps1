# PowerShell script to reset PostgreSQL password and run migrations
# This script helps automate the password reset and migration process

Write-Host "=== PostgreSQL Password Reset & Migration ===" -ForegroundColor Cyan
Write-Host ""

# Prompt for current password
$currentPassword = Read-Host "Enter your current PostgreSQL password for user 'postgres' (or press Enter to skip)"

if ($currentPassword) {
    Write-Host "`nResetting password to 'postgres'..." -ForegroundColor Yellow
    
    # Set password as environment variable for psql
    $env:PGPASSWORD = $currentPassword
    
    # Try to reset password
    $resetResult = psql -U postgres -h localhost -p 5432 -c "ALTER USER postgres WITH PASSWORD 'postgres';" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Password reset successfully!" -ForegroundColor Green
        Write-Host "`nRunning database setup..." -ForegroundColor Yellow
        npm run setup:db
    } else {
        Write-Host "❌ Password reset failed. Error:" -ForegroundColor Red
        Write-Host $resetResult
        Write-Host "`nPlease try manually:" -ForegroundColor Yellow
        Write-Host "1. Open pgAdmin or psql"
        Write-Host "2. Connect with your current password"
        Write-Host "3. Run: ALTER USER postgres WITH PASSWORD 'postgres';"
    }
    
    # Clear password from environment
    $env:PGPASSWORD = $null
} else {
    Write-Host "Skipping password reset." -ForegroundColor Yellow
    Write-Host "`nTo proceed manually:" -ForegroundColor Yellow
    Write-Host "1. Reset password: ALTER USER postgres WITH PASSWORD 'postgres';"
    Write-Host "2. Run: npm run setup:db"
}

