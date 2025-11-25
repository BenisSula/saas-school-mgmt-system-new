# PowerShell script to fix TypeScript return value errors in route handlers
# This script adds explicit return statements after res.json() and next(error) calls

$routeFiles = @(
    "backend/src/routes/admin/classes.ts",
    "backend/src/routes/admin/departments.ts",
    "backend/src/routes/admin/dashboard.ts",
    "backend/src/routes/admin/notifications.ts",
    "backend/src/routes/admin/overview.ts",
    "backend/src/routes/admin/reports.ts",
    "backend/src/routes/admin/userManagement.ts",
    "backend/src/routes/admin/users.ts"
)

foreach ($file in $routeFiles) {
    if (Test-Path $file) {
        Write-Host "Processing $file..."
        $content = Get-Content $file -Raw
        
        # Pattern 1: res.json(...); followed by } catch or } finally
        $content = $content -replace '(res\.(json|status\([^)]+\)\.json)\([^)]+\));(\s*)(\n\s*)(\})(\s*)(catch|finally)', '$1;$3$4return;$3$4$5$6$7'
        
        # Pattern 2: next(error); followed by } or end of catch block
        $content = $content -replace '(next\(error\));(\s*)(\n\s*)(\})(\s*)(\n\s*)(\})', '$1;$2$3return;$2$3$4$5$6$7'
        
        # Pattern 3: res.json(...); at end of try block before catch
        $content = $content -replace '(res\.(json|status\([^)]+\)\.json)\([^)]+\));(\s*)(\n\s*)(\})(\s*)(\n\s*)(catch)', '$1;$3$4return;$3$4$5$6$7$8'
        
        Set-Content $file -Value $content -NoNewline
        Write-Host "  ✓ Fixed $file"
    } else {
        Write-Host "  ✗ File not found: $file"
    }
}

Write-Host "`nDone! Please review the changes and test."

