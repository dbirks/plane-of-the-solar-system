# Phase 1 precision report

- Status: Complete for the Phase 1 browser prototype
- Measurement date: 2026-07-11
- Fixed scenario: `2026-07-11T22:00:00Z`, `39.7684, -86.1581`

## Environment

- Browser: Headless Chrome 146.0.0.0 on Linux x86_64 through `@playwright/cli`
- Viewports inspected: 1440×900, 1280×720, and 390×844
- Device pixel ratio for telemetry run: 1
- Renderer: Three.js `WebGPURenderer` using its WebGL 2 backend
- Renderer paths tested: forced WebGL and automatic WebGPU selection with WebGL 2 fallback
- Depth modes tested: standard and reversed; the automatic/reversed run completed without application errors

The headless Chromium environment reported no available WebGPU adapter, so native WebGPU could not be measured on this host. Its documented WebGL 2 fallback was exercised instead.

## Precision configuration

- Canonical Earth radius and altitude remain double-precision meters.
- The Three camera stays at render origin `[0, 0, 0]`.
- Near clip: `0.00001` render units.
- Far clip: `5000` render units.
- Render scale adapts with altitude while preserving uniform physical proportions.
- A local tangent-cap representation is active near the surface and fades out by 90 km; it was needed to keep near-surface GPU magnitudes small.

At two meters altitude, telemetry estimated a maximum Float32 quantization interval of `0.026 m` for the active local representation. No pixel-scale surface movement, horizon flicker, clipping, observer-marker detachment, or representation pop was seen while traversing the fixed ground, atmosphere, low-orbit, and whole-Earth scenarios. This is an inspected visual result plus a numeric quantization estimate, not a laboratory measurement of sub-pixel motion.

## Performance snapshot

| Measurement                    | Settled result                        |
| ------------------------------ | ------------------------------------- |
| Frame rate                     | 60 fps                                |
| Average frame interval         | 16.7 ms                               |
| Worst sampled frame interval   | 16.7 ms                               |
| Draw calls                     | 2 per frame at ground and whole Earth |
| Geometry resources             | 4 at ground; 5 at whole Earth         |
| Renderer texture resources     | 3 internal textures                   |
| Committed application textures | 0 bytes                               |

Frame intervals are browser animation intervals from the headless session, not CPU/GPU profiler timings. Three's renderer exposes texture-resource count but not a reliable byte total for its internal attachments; Phase 1 ships no application texture assets, so committed texture memory is zero.

## Known limitations and artifacts

- Atmosphere and Earth use simple shaded geometry, intentionally stopping before the later quality/texturing phase.
- Native WebGPU still needs testing on hardware that exposes an adapter.
- Chromium logs expected WebGL `ReadPixels` performance warnings while Playwright takes screenshots; these do not occur during ordinary interaction.
- The automatic renderer logs its expected fallback warning when no WebGPU adapter exists.
- The 977 kB uncompressed renderer bundle is within the transfer budget after gzip (about 276 kB) but remains a future code-splitting opportunity.

## Evidence

- `pnpm check`: 15 unit tests, strict TypeScript, Oxc lint, and production build pass.
- `pnpm test:e2e`: 10 desktop/mobile interaction and automated-capture scenarios pass.
- `pnpm build:pages`: repository-prefixed production build passes.
- `pnpx @playwright/cli@latest`: snapshots, slider fills, landmark clicks, raw mouse drag, mouse wheel, keyboard-accessible state, mobile resize, console inspection, automatic renderer fallback, and screenshots exercised.
- GitHub Actions run `29145270094`: source checks, Pages artifact build/upload, and deployment pass.

Screenshots are in `artifacts/screenshots/`, including clean ground, atmosphere, whole-Earth, mobile, debug, and deployed views.
