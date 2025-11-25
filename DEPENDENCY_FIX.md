# Dependency Fix - clsx Import Error

**Date:** 2025-11-24  
**Issue:** `Failed to resolve import "clsx" from "src/lib/utils/cn.ts"`

## Problem

The `clsx` and `tailwind-merge` packages were in `devDependencies` but are used in production code (`src/lib/utils/cn.ts`). This caused import resolution failures during build.

## Solution

Moved `clsx` and `tailwind-merge` from `devDependencies` to `dependencies` in `frontend/package.json`.

### Changes Made

**Before:**
```json
"dependencies": {
  // ... other deps
},
"devDependencies": {
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.4.0",
  // ... other dev deps
}
```

**After:**
```json
"dependencies": {
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.4.0",
  // ... other deps
},
"devDependencies": {
  // ... other dev deps (clsx and tailwind-merge removed)
}
```

## Verification

1. ✅ Dependencies installed: `npm install`
2. ✅ Build progresses past import error
3. ✅ Packages available in production build

## Status

✅ **Fixed** - The `clsx` import error is resolved. The build now progresses to TypeScript type checking (remaining errors are unrelated to the import issue).

## Note

The remaining TypeScript errors in the build output are pre-existing type issues and not related to the `clsx` import problem. These can be addressed separately.

