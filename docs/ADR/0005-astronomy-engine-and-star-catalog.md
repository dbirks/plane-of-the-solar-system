# 0005 — astronomy-engine and an embedded HYG bright-star catalog

- Status: accepted
- Date: 2026-07-11

## Context

Phase 2 requires the real sky: current Sun, Moon, and bright-planet directions,
Moon phase from physical geometry, and a bright-star point cloud. The spec
names `astronomy-engine` (arcminute-class accuracy, pure TypeScript/JavaScript,
no native or WASM code) and a star subset of roughly 1,500–4,000 stars through
visual magnitude ≈ 5.5. Runtime third-party asset fetches are banned by the
performance budget, and the repository bans a generalized astronomy engine of
our own.

## Decision

1. **`astronomy-engine` (npm, pinned via lockfile) is the single source of
   astronomical truth.** A pure-TypeScript wrapper (`src/astronomy/sky-state.ts`)
   exposes an immutable `SkyState` snapshot: topocentric refracted and geometric
   alt-az, distances in meters, angular radii, visual magnitudes, Moon
   illuminated fraction and phase angle, and a 3×3 EQJ→local-Three rotation for
   the star field. Nothing in `src/astronomy/` imports Three.js.
2. **Star catalog is generated at development time, committed, and embedded.**
   `scripts/generate-star-catalog.mjs` filters the HYG v4.1 database
   (CC BY-SA 4.0) to magnitude ≤ 5.5 — currently 2,865 stars — and emits
   `src/scene/sky/star-catalog.ts` (J2000 RA/dec degrees, magnitude, B−V color
   index, proper names for stars brighter than magnitude 2.1). Builds and
   runtime never touch the network. The generated file is exempt from
   formatting (`.oxfmtignore`).
3. **Verification is non-circular.** Unit tests cross-check astronomy-engine
   against an independent truncated-Meeus reference implementation
   (`src/tests/meeus-reference.ts`): Sun within 0.3°, Moon within 0.5° and
   1,500 km, illuminated fraction within 0.02, at four fixed epochs spanning
   hemispheres and seasons. The star-field rotation path is validated against
   the per-body alt-az path to within 0.1°.

## Consequences

- The EQJ→HOR→local-Three chain reuses the existing `horizonToLocalThree`
  mapping; astronomy-engine's HOR axes ([north, west, zenith]) match the
  documented HOR frame exactly, so no new frame was introduced.
- The embedded catalog adds ~77 KB of source (~25 KB gzipped), well inside the
  transfer budget; regeneration is a one-command, reproducible step.
- astronomy-engine's `rot[i][j]` matrices are source-row/target-column
  (transposed from the usual math convention); the wrapper flattens them
  row-major for consumers and documents this at the call site.
- Star positions ignore proper motion and refraction; both are far below one
  pixel at the rendered field of view.

## Verification

- `src/tests/astronomy.test.ts` — 23 cross-validation cases against Meeus.
- `src/tests/star-catalog.test.ts` — catalog size, ranges, ordering, names.
- `pnpm check` green (lint, strict TypeScript, unit tests, build).
