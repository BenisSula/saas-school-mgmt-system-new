# PostgreSQL Database Setup Script
# This script helps set up the database and run migrations

Write-Host "=== PostgreSQL Database Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if database exists
Write-Host "Checking if database 'saas_school' exists..." -ForegroundColor Yellow

# Try to connect and check database
$dbCheck = psql -U postgres -h localhost -p 5432 -lqt 2>&1 | Select-String "saas_school"

if ($dbCheck) {
    Write-Host "✓ Database 'saas_school' already exists" -ForegroundColor Green
} else {
    Write-Host "✗ Database 'saas_school' does not exist" -ForegroundColor Red
    Write-Host ""
    Write-Host "To create the database, you need to:" -ForegroundColor Yellow
    Write-Host "1. Connect to PostgreSQL (you may need to enter your password)"
    Write-Host "2. Run: CREATE DATABASE saas_school;"
    Write-Host ""
    Write-Host "Or use pgAdmin to create it through the GUI"
    Write-Host ""
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Ensure PostgreSQL password matches .env file (postgres:postgres)"
Write-Host "2. Create database if it doesn't exist"
Write-Host "3. Run migrations: npm run migrate"
Write-Host ""

Write-Host "To reset PostgreSQL password to 'postgres':" -ForegroundColor Yellow
Write-Host "  psql -U postgres -c \"ALTER USER postgres WITH PASSWORD 'postgres';\""
Write-Host ""
Write-Host "Or update .env file with your actual password:" -ForegroundColor Yellow
Write-Host "  DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/saas_school"

