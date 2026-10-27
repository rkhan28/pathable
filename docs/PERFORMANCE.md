# Performance

## Measurements

Lighthouse 13.5, production build served locally, default mobile simulation (4× CPU slowdown, slow 4G) and desktop preset. Third-party tile and geocoder hosts were blocked in the measurement environment, so map tiles are not included. Numbers are from a sandbox, not a field device; treat them as relative.

### Before → after optimisation (landing page, mobile)

| Metric | Before | After |
| --- | --- | --- |
| Performance score | 72 | **80** |
| Largest Contentful Paint | 4.7 s | **4.0 s** |
| Total Blocking Time | 440 ms | **310 ms** |
| CLS | 0 | 0 |
| Speed Index | — | 2.2 s |

Changes that produced this:

1. **Removed the JS-driven entrance from the headline and lede.** They were the LCP element and stayed invisible until hydration + animation. They now paint with the HTML; only the pill and illustration animate.
2. **Lazy command palette.** cmdk and its dialog load on first ⌘K or click; only a key listener ships on every page.
3. **Fewer font files.** Atkinson trimmed from 7 files to 3 weights (no italics, no latin-ext — French is fully covered by the latin subset), Instrument Serif to 1, and the mono face is no longer preloaded.

### Current scores

| Page | Mobile perf | Desktop perf | A11y | Best practices | SEO |
| --- | --- | --- | --- | --- | --- |
| Landing | 80 | 99 | 100 | 100 | 100 |
| Report | 76 | — | 100 | 100 | 100 |
| Settings (fr) | 80 | — | 100 | 100 | 100 |
| Planner with routes | 30–45 (varies run to run) | 79 | 100 | 100 | 100 |

**The planner's mobile score is dominated by MapLibre running on SwiftShader** (software WebGL) in the measurement sandbox, which shows up as ~2.7 s of Total Blocking Time. Its desktop score (79, LCP 1.4 s) is more representative of GPU-backed devices. It needs field measurement on mid-range Android hardware before drawing conclusions.

## What's already in place

- Every route is statically prerendered (Cache Components); the HTML shell arrives without waiting on data.
- MapLibre (~1 MB raw) is code-split with `next/dynamic` and only loads on the planner and report location step.
- Development fixtures are dynamically imported, so they never load in a live build.
- Fonts are self-hosted with `next/font/local` (no third-party requests, automatic size-adjusted fallbacks → CLS 0).
- Address search is debounced (250 ms), cached for 5 minutes, and cancellable.
- Route requests are cached for 2 minutes and keep the previous result visible while preferences change.
- Photos are downscaled to 2048 px and re-encoded to JPEG client-side before upload.
- The Magic UI Dot Pattern was rewritten from hundreds of animated nodes to one SVG pattern.

## Next steps

- Field RUM via `useReportWebVitals` once there's an analytics destination that respects the privacy policy.
- Defer map initialisation until the planner's first paint is idle, and evaluate MapLibre's CSP-friendly build.
- Consider `zod/mini` for client-side persisted-state validation to trim the shared chunk.
- Precompute and cache popular route fixtures server-side once the backend exists.
