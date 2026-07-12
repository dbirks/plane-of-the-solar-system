# 0007 — Earth–Moon system: clamped-ray Moon, EQJ orbit guide, 2D inset

- Status: accepted
- Date: 2026-07-12

## Context

Phase 3 requires the physical Moon at true radius and uncompressed distance,
a jump-free hand-off from the Phase 2 sky proxy, an orbit guide, an
inspection inset, and an Earth–Moon camera composition. The true Moon
(~3.84×10⁸ m) sits far outside the render far plane (5000 units) at
near-ground render scales.

## Decision

1. **Clamped-ray Moon placement** (`src/astronomy/moon-placement.ts`): every
   frame the Moon's position relative to the risen camera is computed in
   meters (topocentric direction from the ground observer, minus the camera's
   zenith altitude — real parallax). If the scaled distance fits inside the
   proxy shell (1300 render units) the mesh sits at the true scaled distance
   (physical, uncompressed); otherwise it sits on the shell along the same ray
   with the same true angular size. The hand-off is continuous by
   construction: same ray, same apparent size, only render depth changes, so
   the Moon cannot visibly jump.
2. **Journey extension**: the slider now spans 2 m → 5×10⁸ m with the
   Earth–Moon landmark at the top; Phase 1 constants were renamed
   `JOURNEY_*`. The whole-Earth landmark holds its exact prior mapping at
   slider 0.78.
3. **Earth–Moon framing** (`earthMoonCompositionForAltitude`): beyond whole
   Earth the guided gaze blends from the nadir toward a midpoint biased 42%
   toward the Moon's ray, and the FOV widens (≤92°) to keep both bodies in
   frame. Free-look offsets ride on top unchanged.
4. **Orbit guide in EQJ meters**: one sidereal month of geocentric positions
   from astronomy-engine `GeoMoon`, expanded to `LineSegments` pairs, oriented
   by the same EQJ→local rotation as the star field (so Earth's spin needs no
   recompute), positioned at the Earth's render center and scaled by
   render-units-per-meter; refreshed when >6 h stale. A sunlight-direction
   guide line shares the anchoring. Both fade in beyond ~4000 km altitude.
   **The WebGPU-flavored renderer does not draw `THREE.LineLoop`** — this was
   verified live; closed paths must be `LineSegments` (or `Line` with a
   repeated closing vertex).
5. **Inset as labeled UI**: the Moon inspection panel renders a 2D-canvas
   phase disc (two-arc terminator construction) plus phase name, illuminated
   fraction, and distance, all derived from the same `SkyState` as the scene,
   so the inset cannot disagree with the geometry. A second 3D viewport was
   rejected as cost without fidelity gain at this phase; revisit for libration
   in a later phase.
6. **Marker persistence**: sky-proxy markers (Sun, planets) fade on ascent;
   the Moon's marker persists at all scales and tracks the placement ray, so
   it remains selectable at system scale (DoD).

## Consequences

- Earth–Moon distance is never compressed once placement is physical
  (`renderDistance / renderUnitsPerMeter === cameraDistanceM`, unit-tested).
- The proxy Moon ignores altitude parallax only in its render _depth_; its
  ray always includes parallax, so the transition window shows no direction
  discontinuity (unit-tested to <1e-5 rad at the boundary).
- Moon rise/set during long sessions moves the proxy smoothly with the 1 Hz
  astronomy tick, unchanged from Phase 2.
- The observer's zenith-rise model means the camera never leaves the
  observer's vertical; a free Earth–Moon orbit camera is out of scope until a
  later phase.

## Verification

- `src/tests/moon-placement.test.ts`: shell/physical regimes, uncompressed
  round-trip, continuity at the hand-off, parallax sign, orbit radius band.
- `src/tests/moon-phase-name.test.ts`: principal/intermediate phases, band
  edges, wraparound.
- `tests/e2e/phase-three.spec.ts`: 500,000 km landmark, selectable Moon marker
  opening an inset that matches the fixed scenario (Waxing gibbous, 74.6%),
  proxy markers fading while the Moon's persists.
- Live Playwright CLI: Earth and Moon share the frame at true scale with the
  orbit guide passing through the Moon; inset readouts match the debug panel.
