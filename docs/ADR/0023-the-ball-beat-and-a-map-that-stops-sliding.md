# ADR-0023: The ball beat, and a map that stops sliding

- Status: accepted
- Date: 2026-07-23

## Context

Round-16 on-device feedback, plus the user's answer to the round-15 design
questions: build the three-beat reveal ("that number one you said").
Reports: the Indy light blob "literally moved locations" between 73 mi and
300 mi; the dot wore two hard-edged bubbles (white + blue) and lost its
outline around 13–15 mi; the hollow edge triangles are the right size but
the filled ones and the space pointers are too small; "Plane of the solar
system" should read centered as you pull out; and a light-gray "flattened
double" of every outer orbit showed at system scale.

## Decision

1. **Three-beat reveal.** `vantageSwingBlendForAltitude` (log 6.9→7.3,
   smootherstep) now drives the vantage swing and the roll onto ecliptic
   north, while `revealBlendForAltitude` (6.1→7.3) keeps driving gates and
   opacities. Between them the journey gains a pure-zoom BALL beat: from
   ~1,300 km to ~8,000 km the camera backs straight out along the observer's
   zenith — the map frame simply recedes, the ground curls into a complete
   ball dead-center with the glowing dot facing the camera — and only then
   does the 35° swing bank the frame onto the plane, finishing at whole
   Earth as before. Orbit-drag yaw pivots about the zenith through the ball
   beat (the globe spins under you) and about ecliptic north after.
2. **Imagery lives in mercator meters.** Patch quads were scaled by linear
   degrees (110,574 m/deg) while their canvas pixels are mercator-spaced —
   over a z6 window (~17° of latitude) that mismatch slides features tens of
   km, differently per level: the observer's own city jumped between zoom
   levels. Extents and offsets now come from web-mercator meters × one
   cos(observer latitude) — conformal, so every level (day and night, Esri
   and GIBS) agrees exactly around the observer.
3. **One glow.** The dot's hard-edged white rim and blue halo shells are
   replaced by a single light-blue radial-gradient sprite (4.2×, no depth
   test). The absolute size cap rises 0.002→0.0035 render units — the old
   cap pinched the dot through the ~10–20 mi band, where its outline
   used to vanish.
4. **Pointer sizes.** Filled edge triangles now match the hollow ones
   (14×12); the on-screen space pointers go 8×7→10×9.
5. **Captions follow the frame.** Past the reveal's start the six caption
   anchors derive from the gaze's own ecliptic longitude (basis vectors
   e₁/e₂ published per astronomy tick): a symmetric pair flanks the globe —
   flank = max(occluder clearance with the 8.5° band lift factored out,
   ≥14° so the texts never run together, ≤26°) — with the rest spaced 60°.
   "Plane of the solar system" reads centered beside the ball wherever and
   whenever you pull out. The ground sky keeps fixed-longitude anchors.
6. **The flat rings are gone.** The system-scale ecliptic rings sat at
   10/20/30/40 AU — almost exactly under Saturn, Uranus, Neptune, and Pluto
   — and read as a gray flattened double of every outer orbit. The plane is
   told by the labeled band and the orbits themselves; the "Ecliptic plane"
   toggle still governs the sky band.

## Consequences

- 105 unit tests (new vantage-swing coverage), 44 e2e green; verified live
  at dusk sim: ball beat at 1,850 mi (night US dead-center, dot glowing),
  swing settled at 37,729 mi with flanking captions on the flat band, no
  ghost rings at the inner system, blob steady across 73→300 mi.
- The reveal's swing now happens over 0.4 decades instead of 1.2 — but from
  a vantage where Earth is already a complete centered ball, so nothing
  slides off-frame; smootherstep keeps both ends still.
