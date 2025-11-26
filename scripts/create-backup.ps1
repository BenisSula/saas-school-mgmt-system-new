# PowerShell script to create backup of backend directory
# PHASE 0 - PREP: Create backups and manifest

$ErrorActionPreference = "Stop"

# Get current date/time for backup filename
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$backupDir = Join-Path $PSScriptRoot ".." "backups"
$backupFile = Join-Path $backupDir "saas_school_backend_backup_$timestamp.tar.gz"
$backendDir = Join-Path $PSScriptRoot ".." "backend"

# Create backups directory if it doesn't exist
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Write-Host "Created backups directory: $backupDir"
}

# Check if backend directory exists
if (-not (Test-Path $backendDir)) {
    Write-Error "Backend directory not found at: $backendDir"
    exit 1
}

# Check if tar is available (Windows 10+ has tar built-in)
$tarAvailable = Get-Command tar -ErrorAction SilentlyContinue

if ($tarAvailable) {
    Write-Host "Creating backup using tar..."
    # Change to parent directory to create proper archive structure
    $parentDir = Split-Path $backendDir -Parent
    $backendName = Split-Path $backendDir -Leaf
    
    Push-Location $parentDir
    try {
        tar -czf $backupFile $backendName
        if ($LASTEXITCODE -eq 0) {
            $fileSize = (Get-Item $backupFile).Length / 1MB
            Write-Host "✓ Backup created successfully: $backupFile"
            Write-Host "  Size: $([math]::Round($fileSize, 2)) MB"
        } else {
            Write-Error "tar command failed with exit code: $LASTEXITCODE"
            exit 1
        }
    }
    catch {
        Write-Error "Error creating backup: $_"
        exit 1
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "tar not available, creating ZIP backup instead..."
    $zipFile = $backupFile -replace '\.tar\.gz$', '.zip'
    
    # Use .NET compression to create ZIP
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($backendDir, $zipFile)
    
    $fileSize = (Get-Item $zipFile).Length / 1MB
    Write-Host "✓ Backup created successfully: $zipFile"
    Write-Host "  Size: $([math]::Round($fileSize, 2)) MB"
}

Write-Host ""
Write-Host "Backup location: $backupDir"
Write-Host "Backup file: $(Split-Path $backupFile -Leaf)"

