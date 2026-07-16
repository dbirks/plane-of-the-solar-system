# ADR-0019: Altitude-riding near plane and the band's three acts

- Status: accepted
- Date: 2026-07-16

## Context

Round-12 on-device feedback, all traced to two roots:

- "Tons of flashing" through the satellite leg, tiles "spazzing out,
  clipping with the curvature of the earth", and at whole Earth "a bunch of
  clipping around stuff... a lot of visual artifacts [that] move really
  fast".
- The plane-of-the-solar-system band slicing through the map view ("as soon
  as we start showing satellite view, remove the plane... you see the
  dotted lines"), and in space no label plus the band crossing in front of
  the globe ("it goes behind the Earth without the double lines").

Root cause one: **depth precision, not geometry.** ADR-0018 flipped the
default depth mode to standard (reversed depth never rasterizes the
CanvasTexture imagery quads on the WebGL backend), but the near plane was a
fixed `1e-5` render units against a far of `50_000` — a 5×10⁹ ratio. A
24-bit standard depth buffer quantizes roughly by `z²/(near·2²⁴)`: at the
44-mile view that is a ~0.1-render-unit step (≈1,800 m at that scale), and
at whole Earth the step exceeded the globe's whole render radius. Every
depth test — imagery quads vs. terrain, atmosphere shells vs. globe, band
vs. limb — became per-frame noise. Ground level never showed it (z tiny, so
z² vanishes), which is why the breakage "appeared" only above the map leg.
ADR-0018's claim that "near/far scaling keeps depth precision across the
journey" was wrong: only the `systemReveal` far-stretch branch scaled near.

Root cause two: **the sky-shell band never left.** It faded only with
`systemReveal` (≥10⁹ m), so its fill/edges washed across the map view and
its below-horizon dashes (depth test off, renderOrder 3) drew on top of
the imagery; in space the broken depth test let it paint over the globe.

## Decision

1. **The near plane rides the altitude**
   (`nearPlaneRenderUnitsForAltitude`): `min(900, max(1e-5, altitude·upm·
0.15))`. Nothing renderable sits closer than a good fraction of the
   altitude — the nearest content IS the ground/globe at altitude away;
   the worst case (the Moon at the Earth–Moon leg) stays beyond 0.15×. The
   900 cap keeps the camera-anchored sky shell (bodies 1300, stars 1500)
   inside the frustum at full journey. Unit-tested: the depth step at the
   Earth-surface distance stays under 0.2% of z at every journey altitude
   (the atmosphere-shell gap it must resolve is 2.5%).

2. **Imagery quads stop depth-testing** (`depthTest: false`, matching their
   existing `depthWrite: false`). Flat patches lifted meters above a
   spherical terrain can never share a depth buffer honestly; renderOrder
   already layers them over the ground and under the observer dot.

3. **The band plays three acts.** Act one, ground: unchanged — band, fill,
   below-horizon dashes, captions. Act two, the map/satellite leg: all of
   it fades out over 15–55 m with the map takeover (`1 − mapLeg`, where
   `mapLeg = smoothstep(15, 55, alt) · (1 − revealBlendForAltitude(alt))`)
   — nothing slices the imagery. Act three, space: band and fill return
   with the reveal bank and now depth-test cleanly BEHIND the globe; the
   dashes never return (no "double lines" in space — `groundFade` already
   held them under 120 km). The "Plane of the solar system" caption rides
   along: `0.55·(1 − smoothstep(15, 55, alt)) + 0.7·revealBlend·(1 −
systemReveal)`, and captions whose anchor falls within the Earth's
   apparent disc (+6° margin) hide instead of floating over the planet
   (`PlaneGuides.occluder`).

## Consequences

- Whole Earth is clean — no splotches, no starburst, smooth terminator; the
  band terminates at the limb (verified live at 345 m, 4,795 mi, 30,606 mi,
  and 80 AU).
- The thin line still crossing the globe's face at ~30k mi is the Moon-orbit
  guide — geometrically correct (its near arc IS in front) and toggleable.
- The readout gotcha rediscovered while verifying: "Altitude" adds the
  observer's ground elevation above sea level, so Ground near Indianapolis
  legitimately reads ~820 ft.
- 104 unit tests; 44 e2e.
