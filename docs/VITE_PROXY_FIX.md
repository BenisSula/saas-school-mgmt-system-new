# Vite Proxy Error Fix

**Date:** January 2025  
**Issue:** `[vite] http proxy error: /auth/health`

## Root Cause

The Vite proxy was failing when trying to forward requests to the backend because:
1. **No error handling** - Proxy errors weren't being caught or logged
2. **No timeout** - Requests could hang indefinitely
3. **Poor error messages** - No indication of what went wrong
4. **Backend health endpoint** - Could hang if database connection was slow

## Fixes Applied

### 1. Enhanced Vite Proxy Configuration (`frontend/vite.config.ts`)

**Added:**
- Error handling with `proxy.on('error')` to catch and log proxy failures
- Request logging with `proxy.on('proxyReq')` to track proxied requests
- Timeout configuration (10 seconds)
- Proper error responses when backend is unavailable
- Disabled WebSocket for `/api` proxy (only `/ws` uses WebSocket)

**Result:**
- Better error messages when backend is down
- Logging helps debug proxy issues
- Timeout prevents hanging requests

### 2. Improved Health Endpoint (`backend/src/routes/auth.ts`)

**Added:**
- Query timeout protection (5 seconds)
- Better error logging
- More detailed error messages in development mode
- Proper error handling for database connection issues

**Result:**
- Health check won't hang indefinitely
- Better debugging information
- Graceful degradation when database is unavailable

## Testing

### To verify the fix:

1. **Start Backend:**
   ```bash
   cd backend
   npm run dev
   ```
   Should see: `Backend server listening on port 3001`

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Check Browser Console:**
   - Should see `[Vite Proxy] GET /auth/health -> /auth/health` logs
   - No proxy errors if backend is running
   - Clear error message if backend is down

4. **Test Health Endpoint Directly:**
   ```bash
   curl http://localhost:3001/auth/health
   ```
   Should return: `{"status":"ok","db":"ok","timestamp":"..."}`

## Common Issues

### Backend Not Running
**Symptom:** Proxy error with message about backend not running  
**Fix:** Start backend server on port 3001

### Backend on Different Port
**Symptom:** Proxy errors, backend running on different port  
**Fix:** Update `vite.config.ts` proxy target to match backend port

### Database Connection Issues
**Symptom:** Health check returns 503 with db: 'error'  
**Fix:** Check database connection in backend/.env

### Port Already in Use
**Symptom:** Backend fails to start  
**Fix:** Backend will automatically try next port (3002, 3003, etc.)  
**Note:** Update Vite proxy target if backend uses different port

## Proxy Configuration Details

```typescript
'/api': {
  target: 'http://127.0.0.1:3001',
  changeOrigin: true,
  secure: false,
  rewrite: (path) => path.replace(/^\/api/, ''),
  timeout: 10000,
  // Error handling and logging
}
```

**How it works:**
- Frontend requests `/api/auth/health`
- Vite rewrites to `/auth/health`
- Proxies to `http://127.0.0.1:3001/auth/health`
- Backend responds
- Vite forwards response to frontend

## Impact

- **Before:** Silent proxy failures, unclear error messages
- **After:** Clear error messages, logging, timeout protection
- **Result:** Easier debugging and better user experience

