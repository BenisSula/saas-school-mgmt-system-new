# Pre-Production Checklist

**Generated:** 2025-11-24T12:06:59.644Z

## Summary

- Total Checks: 10
- ✅ Passed: 0
- ❌ Failed: 4
- ⚠️  Warnings: 6

## Test Results

| Check | Status | Notes |
|-------|--------|-------|
| Backend Jest Tests | ❌ FAIL | Command failed: npm run test --prefix backend |
| Frontend Vitest Tests | ❌ FAIL | Command failed: npm run test --prefix frontend |
| Playwright E2E Tests | ⚠️  WARN | Command failed: npm run test:e2e --prefix frontend |
| NPM Audit | ⚠️  WARN | Command failed: npm audit --json |
| Backend TypeScript Build | ❌ FAIL | Command failed: npm run build --prefix backend |
| Frontend Production Build | ❌ FAIL | Command failed: npm run build --prefix frontend |
| Backend Type Check | ⚠️  WARN | Command failed: npx tsc --noEmit --project backend/tsconfig.json |
| Frontend Type Check | ⚠️  WARN | Command failed: npx tsc --noEmit --project frontend/tsconfig.json |
| Backend Lint | ⚠️  WARN | Command failed: npm run lint --prefix backend |
| Frontend Lint | ⚠️  WARN | Command failed: npm run lint --prefix frontend |

## 🚨 Critical Issues

- Backend Jest Tests
- Frontend Vitest Tests
- Backend TypeScript Build
- Frontend Production Build
