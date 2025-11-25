# Port Conflict Resolution Guide

## Issue: Port 3001 Already in Use

When starting the backend server, you may encounter:
```
Error: listen EADDRINUSE: address already in use :::3001
```

## Common Causes

1. **Docker Container Running**: A Docker container is using port 3001
2. **Previous Backend Instance**: A previous backend process didn't shut down properly
3. **Another Application**: Another service is using port 3001

## Solutions

### Solution 1: Stop Docker Container (Recommended)

If you're running the backend locally (not in Docker):

```powershell
# Check for running containers
docker ps --filter "publish=3001"

# Stop the container
docker stop saas-school-mgmt-system-backend-1

# Or stop all containers
docker-compose down
```

### Solution 2: Kill Node.js Process

If a Node.js process is holding the port:

```powershell
# Find the process using port 3001
netstat -ano | findstr :3001

# Kill the process (replace PID with the actual process ID)
taskkill /PID <PID> /F

# Or find and kill all Node.js processes
Get-Process node | Stop-Process -Force
```

### Solution 3: Change Backend Port

If you want to run both Docker and local backend:

1. Create/update `.env` file in `backend/`:
```env
PORT=3002
```

2. Update `frontend/.env` or `frontend/.env.local`:
```env
VITE_API_URL=http://localhost:3002
```

3. Restart the backend server

### Solution 4: Use Docker Compose

If you prefer to run everything in Docker:

```powershell
# Stop local processes
# Then start Docker containers
docker-compose up -d
```

## Verification

After resolving the conflict, verify the port is free:

```powershell
# Check if port 3001 is free
netstat -ano | findstr :3001

# Should return nothing if port is free
```

## Prevention

1. **Always stop containers before running locally**:
   ```powershell
   docker-compose down
   ```

2. **Use process managers** (PM2, nodemon) that handle cleanup better

3. **Check for running processes** before starting:
   ```powershell
   Get-Process node -ErrorAction SilentlyContinue
   ```

## Quick Fix Script

Create a `stop-backend.ps1` script:

```powershell
# Stop Docker containers
docker-compose down

# Kill Node.js processes on port 3001
$port = 3001
$processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($processes) {
    $processes | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force
    }
    Write-Host "Stopped processes on port $port"
} else {
    Write-Host "Port $port is free"
}
```

---

**Last Updated**: 2025-11-24

