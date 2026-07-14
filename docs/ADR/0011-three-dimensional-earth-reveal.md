# 0011 — the 3D Earth reveal: an arcing camera and plane guides everywhere

- Status: accepted
- Date: 2026-07-13

## Context

Second round of live journey feedback: the pull-out kept the observer's dot
pinned at screen center so Earth never read as a free-standing ball ("I want
to see the Earth standing alone, and my speck on the side"); by day the Sun
ended up behind the camera so the system assembled facing away from it; the
stretch between the atmosphere and whole Earth was an empty blur that
dragged; the Moon's orbit guide ran tangent to the Moon instead of through
it; the single ecliptic sky line was too subtle and unexplained; the chip
showed raw coordinates too wide for phones; long miles readouts clipped.

## Decision

1. **The reveal arc.** The camera's direction from Earth's center is no
   longer pinned to the observer's zenith: from 200 km it slerps
   (`cameraArcBlendForAltitude`, log-altitude 5.3 → 7.3) onto a reveal
   vantage `normalize(−sunDir + 0.45·eclipticNorth)` — anti-sunward, raised
   ~24° above the ecliptic. The guided gaze stays pinned on Earth's center
   (the arc quaternion premultiplies the base orientation), so by whole
   Earth the planet stands alone with the observer's dot on its side and
   the Sun, Mercury, and Venus in the background — the same composition day
   or night, and the terminator/city-lights hemisphere faces the viewer.
   Camera-relative rendering made this cheap: Earth's center became a
   vector (`earthCenterRender`) instead of a Y offset, and every consumer
   (globe, lights, guides, layers, observer marker, geo rays) follows it.
2. **Geometric Moon placement.** `computeMoonPlacement` now takes explicit
   camera and Moon positions relative to the ground observer; at system
   scales the Moon position blends onto the same `GeoMoon` EQJ chain that
   generates its orbit guide, so the mesh sits exactly on the line (the
   old refracted topocentric ray left it visibly tangent).
3. **Frame-correct look-at.** Marker click-to-look transforms the target ray
   into the (arced, rolled) base frame and derives yaw/pitch offsets from
   it, valid at every scale — including "over the top" solutions when the
   target is behind the nadir.
4. **Faster quiet leg.** Journey re-anchored: atmosphere 0.22, low orbit
   0.29, whole Earth 0.42, Earth–Moon 0.6, inner system 0.82 — the
   atmosphere → whole-Earth blur now spans 20% of the slider instead of
   36%, and the assembling system owns the rest.
5. **The plane, labeled.** The sky ecliptic is a ±1.5° band (edge lines +
   translucent fill) with three screen-space captions reading "Plane of the
   solar system" riding its slope (`PlaneGuideAnchor`s at ecliptic
   longitudes 15°/135°/255°, projected per frame, rotated to the band's
   local screen direction, hidden when behind the camera).
6. **Nearest-place chip.** The observer chip shows "Near Indianapolis, IN"
   instead of raw coordinates: a bundled GeoNames subset (population ≥ 100k,
   city sections excluded; 5,807 places, CC BY 4.0) matched on-device by an
   equirectangular nearest-neighbor scan, US states abbreviated, other
   countries via `Intl.DisplayNames`. Null beyond 400 km (open ocean) falls
   back to the old label. Exact coordinates stay in the expanded panel;
   nothing leaves the device.
7. **Readout never clips.** The scale readout is shrink-to-fit, anchored
   right, capped to the viewport with a clamped font on small screens.

## Consequences

- Near local noon the observer's dot is on the far (day) side of the ball —
  geometrically unavoidable with the Sun in the background; it returns to
  view through the evening and night.
- The Earth–Moon FOV widening measures the Moon's separation from the
  Earth-pinned gaze (was: from straight down), matching the arc.
- e2e slider anchors, camera tests, and the screenshots spec moved to the
  new landmark positions.

## Verification

- 89 unit tests: arc blend band and monotonicity, re-anchored slider maps,
  gaze-relative FOV widening, off-zenith Moon placement landing on the true
  point, place-catalog lookups (Indianapolis/Berlin/Sydney/antimeridian/
  ocean-null).
- Live Playwright CLI, day scenario (18:00 UTC): whole Earth stands alone
  showing the night hemisphere with the Sun's glow beyond the pole;
  Earth–Moon shows a level orbit with the Moon ON the line and the Sun
  riding the labeled plane band; night scenario converges to the same
  composition with the observer dot visible on the side of the ball.
