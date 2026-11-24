# Performance audit — v18

Measured with Chrome (Playwright) on a simulated mid-range phone: CPU slowed 4×, slow-4G network (1.6 Mbps, 150 ms RTT).
Note: the local test server sends files uncompressed; Vercel/Netlify serve them with Brotli/Gzip (index.html ≈ 220 KB instead of ≈ 720 KB), so real load times are shorter than the figures below.

## Root causes found
| # | Cause | Impact |
|---|-------|--------|
| 1 | Loading screen waited for the browser `load` event (every font + image) | Mobile visitors stared at the loader for ~7.5 s |
| 2 | Render-blocking stylesheet loading 12+ decorative font families used only in portfolio artboards | Extra blocking request on every page |
| 3 | Oversized logos (633 px and 512 px PNGs shown at 36–130 px) | 217 KB on first load |
| 4 | Studio carousel autoplayed an MP4 on phones | +623 KB and continuous video decoding on mobile |
| 5 | Hero rocket canvas: ~800 faces per frame at 1.5× resolution, 60 fps | Hero dropped to ~25 fps on phones |
| 6 | Continuous CSS effects (animated glow text with filters, floating orbs, blurred spinning gradients, backdrop blur on tiles) | Studio section ~29 fps on phones |

## Fixes
- Loader hides right after the first render (max 1.2 s), no longer waits for all assets.
- Decorative fonts load after first paint (non-blocking); unused Alexandria 900 weight removed.
- Logos converted to right-sized WebP: logo 78 KB → 21 KB, badge 139 KB → 13 KB, small WhatsApp art 29 KB → 6 KB.
- Videos/posters lazy-load near the viewport; phones, Data Saver and 2G/3G get posters only (tap to play).
- Rocket: 30 fps cap on phones/low-end devices, lighter mesh, adaptive quality that steps down automatically when frames are slow.
- Heavy continuous CSS effects disabled on phones; tile backdrop blur removed; reduced-motion respected everywhere.
- Chat assistant, music player and fire cursor initialise when the browser is idle (after the first render).
- Long-term caching for media/icons (vercel.json + _headers for Netlify). Rename a media file if you replace it.
- CLS measured at 0 (images carry width/height).

## Results (home page, mobile, CPU 4×)
| Metric | Before | After |
|---|---|---|
| Data downloaded | 1.70 MB | 0.96 MB |
| Main-thread blocking (sum of long tasks > 50 ms) | 1,976 ms | ~900 ms |
| Long tasks | 32 | 9 |
| Studio section frame rate | ~29 fps | ~45–55 fps |
| Hero frame rate | ~17–25 fps | ~30 fps (rocket capped at 30 fps by design) |
| Layout shift (CLS) | 0 | 0 |

Not done automatically: removing "unused" CSS — the site builds many class names at runtime, so an automatic purge could silently break pages. CSS is ~25 KB after compression.
