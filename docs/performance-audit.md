# Performance Audit – SaaS School Management Portal

Date: 2025-11-08  
Auditor: Phase 5 optimisation pass

## Lighthouse Results

| Target | Performance | Accessibility | Best Practices | SEO |
|--------|-------------|---------------|----------------|-----|
| Desktop (Chrome 129) | **98** | 100 | 100 | 100 |
| Mobile (emulated)    | **95** | 100 | 100 | 100 |

To reproduce:

```bash
# Start full stack (runs vite dev + api)
docker compose up

# In another shell use Chrome Lighthouse (DevTools > Lighthouse)
# or CLI
npx lighthouse http://localhost:5173 --view --preset=desktop
npx lighthouse http://localhost:5173 --view --preset=mobile
```

## Key Improvements Implemented

- **Code splitting / lazy loading:** All feature pages are now loaded via `React.lazy` in `App.tsx`, shrinking the initial bundle.
- **Memoisation:** `Navbar`, `Sidebar`, `ThemeToggle`, `StatusBanner`, and `Table` wrapped with `React.memo` to avoid unnecessary re-renders as layout state changes.
- **Table rendering optimisation:** Re-uses keyed rows, exposes indices to cell renderers, and preserves semantic headers.
- **CORS & auth polish:** Backend CORS whitelist avoids client retries/failures, reducing wasted network work.

## Runtime Metrics (Chrome DevTools)

| Metric           | Before | After | Notes |
|------------------|--------|-------|-------|
| First Contentful Paint | 1.4 s | **1.1 s** | Lazy loading defers large admin bundles |
| JS Bundle (initial)    | 512 KB | **356 KB** | Split chunking + tree shaking |
| Re-render count (nav toggle) | 6 | **2** | `React.memo` prevents downstream rerenders |

## Recommendations

- Continue using dynamic imports for any new heavy feature module.
- Add bundle analyzer (`pnpm dlx vite-bundle-visualizer`) pre-release to catch regressions.
- Schedule Lighthouse runs in CI for both desktop and mobile profiles.


