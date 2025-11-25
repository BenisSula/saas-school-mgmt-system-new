# Deletion Application Script
# Processes files from delete_candidates.json in batches
# Requires: delete_candidates.json with safe_to_delete_now array populated

param(
    [int]$BatchSize = 5,
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"

# Load delete candidates
$candidatesPath = Join-Path $PSScriptRoot "delete_candidates.json"
if (-not (Test-Path $candidatesPath)) {
    Write-Error "delete_candidates.json not found at $candidatesPath"
    exit 1
}

$candidates = Get-Content $candidatesPath | ConvertFrom-Json
$filesToDelete = $candidates.safe_to_delete_now

if ($filesToDelete.Count -eq 0) {
    Write-Host "No files in safe_to_delete_now array. Nothing to delete." -ForegroundColor Yellow
    Write-Host "Review delete_candidates.json and ensure files meet deletion criteria." -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($filesToDelete.Count) files ready for deletion" -ForegroundColor Cyan
Write-Host "Batch size: $BatchSize" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "DRY RUN MODE - No files will be deleted" -ForegroundColor Yellow
}

# Create backup base directory
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$backupBase = Join-Path $PSScriptRoot "deleted_candidates" $timestamp
New-Item -ItemType Directory -Force -Path $backupBase | Out-Null

# Process in batches
$batchNumber = 1
$totalBatches = [math]::Ceiling($filesToDelete.Count / $BatchSize)

for ($i = 0; $i -lt $filesToDelete.Count; $i += $BatchSize) {
    $batch = $filesToDelete[$i..([math]::Min($i + $BatchSize - 1, $filesToDelete.Count - 1))]
    $batchDir = Join-Path $backupBase "batch-$batchNumber"
    New-Item -ItemType Directory -Force -Path $batchDir | Out-Null
    
    Write-Host "`n=== Processing Batch $batchNumber of $totalBatches ===" -ForegroundColor Green
    Write-Host "Files in batch: $($batch.Count)" -ForegroundColor Cyan
    
    # Move files to backup
    $filesToGitRm = @()
    foreach ($filePath in $batch) {
        if (-not (Test-Path $filePath)) {
            Write-Warning "File not found: $filePath (may already be deleted)"
            continue
        }
        
        $fileName = Split-Path $filePath -Leaf
        $backupPath = Join-Path $batchDir $fileName
        
        Write-Host "  Backing up: $filePath" -ForegroundColor Gray
        if (-not $DryRun) {
            Copy-Item -Path $filePath -Destination $backupPath -Force
        }
        $filesToGitRm += $filePath
    }
    
    if ($filesToGitRm.Count -eq 0) {
        Write-Host "  No files to process in this batch" -ForegroundColor Yellow
        $batchNumber++
        continue
    }
    
    # Create git tag before deletion
    $tagName = "backup/delete-candidate-$timestamp-batch-$batchNumber"
    Write-Host "  Creating git tag: $tagName" -ForegroundColor Cyan
    if (-not $DryRun) {
        git tag -a $tagName -m "Backup before deletion batch #$batchNumber"
    }
    
    # Remove files from git
    Write-Host "  Removing files from git..." -ForegroundColor Cyan
    if (-not $DryRun) {
        git rm $filesToGitRm
    } else {
        Write-Host "    [DRY RUN] Would run: git rm $($filesToGitRm -join ' ')" -ForegroundColor Yellow
    }
    
    # Commit
    $commitMessage = "chore: remove unused files batch #$batchNumber`n`nFiles removed:`n$($filesToGitRm | ForEach-Object { "  - $_" } | Out-String)"
    Write-Host "  Committing changes..." -ForegroundColor Cyan
    if (-not $DryRun) {
        git commit -m $commitMessage
    } else {
        Write-Host "    [DRY RUN] Would commit with message:" -ForegroundColor Yellow
        Write-Host $commitMessage -ForegroundColor Gray
    }
    
    # Run build and tests
    Write-Host "  Running build and tests..." -ForegroundColor Cyan
    if (-not $DryRun) {
        $buildResult = & npm run build 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Build failed after batch $batchNumber!`n$buildResult"
            Write-Host "`nTo restore files:" -ForegroundColor Red
            Write-Host "  git checkout $tagName" -ForegroundColor Yellow
            Write-Host "  Copy files from: $batchDir" -ForegroundColor Yellow
            exit 1
        }
        
        $testResult = & npm test 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Tests failed after batch $batchNumber, but build passed."
            Write-Host "Test output:" -ForegroundColor Yellow
            Write-Host $testResult -ForegroundColor Gray
            Write-Host "`nTo restore files if needed:" -ForegroundColor Yellow
            Write-Host "  git checkout $tagName" -ForegroundColor Yellow
            Write-Host "  Copy files from: $batchDir" -ForegroundColor Yellow
        } else {
            Write-Host "  ✅ Build and tests passed!" -ForegroundColor Green
        }
    } else {
        Write-Host "    [DRY RUN] Would run: npm run build && npm test" -ForegroundColor Yellow
    }
    
    $batchNumber++
}

Write-Host "`n=== Deletion Complete ===" -ForegroundColor Green
Write-Host "Total batches processed: $($batchNumber - 1)" -ForegroundColor Cyan
Write-Host "Backup location: $backupBase" -ForegroundColor Cyan
Write-Host "`nTo restore any batch:" -ForegroundColor Yellow
Write-Host "  git checkout backup/delete-candidate-$timestamp-batch-<N>" -ForegroundColor White
Write-Host "  Copy files from: $backupBase\batch-<N>" -ForegroundColor White

