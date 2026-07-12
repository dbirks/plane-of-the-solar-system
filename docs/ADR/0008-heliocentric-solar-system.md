# 0008 — heliocentric solar system to Pluto

- Status: accepted
- Date: 2026-07-12

## Context

Phase 4 requires true current heliocentric positions and radii for Mercury
through Neptune plus Pluto, selectable markers, precomputed orbit lines, an
ecliptic-plane guide, and inner-system (4×10¹¹ m) and full-system (8×10¹² m)
landmarks — without enlarging any body.

## Decision

1. **One EQJ-meters group, Earth-anchored.** `SolarSystemLayer` holds all
   heliocentric geometry (Sun sphere at true radius, planet spheres at true
   radii, orbit lines, ecliptic rings) in J2000-equatorial meters. A child
   group is offset by −earthHelio each astronomy tick, and the root is
   oriented by the same EQJ→local rotation as the star field, positioned at
   Earth's render center, and uniformly scaled. Geocentric placement therefore
   falls out of one translate + one shared rotation, and Earth's spin never
   forces recomputation.
2. **Two-stage adaptive render scale.** Stage one is unchanged (Phase 1).
   Stage two shrinks the Earth-render-radius log-linearly from 2.15 units at
   20,000 km to 0.004 units at the 8×10¹² m journey end, keeping the whole
   system inside the far plane (extended 5,000 → 50,000 render units; reversed
   depth keeps near-surface precision). Proportions stay uniform — planets are
   honest sub-pixel dots at system scale, and markers carry discoverability.
3. **Journey re-anchored** with inner-system and full-system landmarks; the
   composition anchors track the moved whole-Earth position exactly.
4. **Sky-proxy hand-off.** The proxy Sun disc and planet points fade over
   1–8×10⁹ m as the physical layer fades in; marker positions switch to
   camera-relative geocentric rays (parallax-correct) over the same window.
   Markers reappear for all ten bodies at system scale and stay selectable —
   selection opens a details inset (distances from observer and Sun,
   magnitude); the Moon keeps its phase inset.
5. **Ecliptic plane** is communicated by the orbit lines plus faint rings at
   10/20/30/40 AU lying exactly in the J2000 ecliptic, computed via
   astronomy-engine's ECL→EQJ rotation. The final composition aims at the Sun
   with an 78° FOV, showing the plane obliquely.
6. **Orbit lines** sample one true orbital period per planet (192 points,
   `PlanetOrbitalPeriod`), built lazily on first entry into the system-scale
   band (~1,500 astronomy-engine calls, one-time).

## Consequences

- `scaleDomainForDistance` now switches to `heliocentric` at 10⁹·10 m; slider
  tests and older e2e anchors were updated for the re-anchored journey.
- A pending marker look-at is cancelled by scale travel (found live: a stale
  Neptune look-at fought the landmark recentering and misframed the view).
- Pluto's eccentric, inclined orbit is visibly off-center at full-system scale
  — physically correct and a deliberate part of the composition.
- Bodies far from the camera can exceed Float32 precision in EQJ meters by
  ~meters — orders of magnitude below a pixel at system scale.

## Verification

- `src/tests/solar-system.test.ts`: per-planet heliocentric distance bands,
  ecliptic-latitude bounds (orbit inclinations), orbit-line radius bands,
  ecliptic ring planarity, obliquity of the ecliptic pole.
- `tests/e2e/phase-four.spec.ts`: 53.48 AU full-system landmark in the
  heliocentric domain, ten markers, Pluto selectable (keyboard path) with a
  plausible AU readout, outer-planet markers visible over their orbits.
- Live Playwright CLI: full-system view shows all orbits obliquely with
  markers riding them; inner-system view centers the Sun with Mercury, Venus,
  and Mars on their rings; Neptune's inset reads 29.4 / 29.9 AU. 60 fps held.

## Amendment (2026-07-12): ecliptic screen-up roll

User feedback: the outward journey kept the observer's ground orientation as
screen-up, so the solar system arrived tilted and the "I am standing on the
side of a planet" realization never landed. The camera now rolls screen-up
from the local zenith onto the J2000 ecliptic north across the band beyond
Earth–Moon (log-altitude 8.9 → 11.2, `eclipticRollBlendForAltitude`): the
system's plane settles flat on screen while the ground visibly tilts away.
Implemented as a signed roll about the gaze axis applied to the base
orientation; free-look offsets ride on top unchanged, and the blend is zero
through every Phase 1–3 scale so earlier compositions are untouched.
