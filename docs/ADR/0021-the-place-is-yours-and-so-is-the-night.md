# ADR-0021: The place is yours, and so is the night

- Status: accepted
- Date: 2026-07-22

## Context

Round-14 on-device feedback, two themes: the app should treat the observer's
location as live state (not a page-load parameter), and the night side of the
journey deserved real data.

1. Pressing the location button reloaded the page (`window.location.search =`)
   — jarring, and it dropped the tilt toggle, which lived only in memory.
2. On a first open the sky used the timezone centroid even when the browser
   had already been granted geolocation on an earlier visit; the band read
   "too low" and the user suspected wrong coordinates. (The coordinates were
   right — see "Verified, not changed".)
3. Off-screen markers: the edge arrow pointed RIGHT for a body off the LEFT
   edge, and below-horizon off-screen bodies showed a directionless circle.
4. The imagery pyramid jumped between sharp and blurry (3-zoom spacing), and
   above ~700 mi the night side handed off to a 2048-px Black Marble — mush.
   The user asked for real night imagery "as low as possible".
5. Paper cuts: settings dialog not full width; compass mode a button instead
   of a switch; inaccurate "turn toward" copy; inset ×s still small; tilt
   silently inert off the ground; the ~1,000 mi bank onset too fast.

## Decision

1. **Observer is app state.** The store owns `observer`; applying a location
   updates it, `history.replaceState`s the `?lat/lon` URL, saves to local
   storage, and the renderer re-aims IN PLACE (`setObserverLocation`): the
   zenith quaternions re-derive (globe, outlines, guides, axis stubs), the
   imagery patches recreate around the new point, astronomy timestamps reset.
   No reload, ever.
2. **Granted permission is adopted silently at startup.** If
   `permissions.query({name:"geolocation"})` reports `granted` (a previous
   explicit tap), the opening sky re-aims to the device position — still
   never prompting a fresh visitor (ADR-0006 holds). Explicit locates are
   also auto-remembered.
3. **Tilt persists** (`plane-phone-look-v1`); `restorePhoneLook()` re-engages
   it at startup (iOS resolves an already-granted permission without a
   gesture). Off the ground the toggle stays ON but shows dormant (dashed
   outline, dimmed) since tilt drives nothing above 60 m.
4. **Edge markers point true.** CSS rotation is clockwise on a y-down screen,
   so the rotation is `atan2(-ndcX, -ndcY)` — the old sign mirrored left and
   right. Below-horizon off-screen bodies now show a HOLLOW triangle rotated
   the same way (SVG-outline pointer) instead of the directionless circle.
5. **Seven imagery levels** (z18…z6, every 2 zooms) with ceilings
   5k/20k/80k/300k/900k/2.5M/∞ — each handoff is a gentle blur, not a jump.
6. **The night is real VIIRS.** NASA GIBS Black Marble tiles (z≤8, CORS `*`,
   2016 composite) ride the two widest patches as additive amber overlays,
   crossfading z8→z6 at 250–450 km so they never stack (stacked, or untinted
   and uncapped, a metro whites out the frame under ACES — capped at 0.3 with
   a warm tint it reads as city glow). Lights fade in 25–70 km as z8's
   ~600 m/px starts reading sharp; below, the cool-dimmed streets carry the
   night. And the globe's night texture doubled to 4096 (Black Marble 2016,
   ~570 KB) so the >700 mi night Earth is coastlines and cities, not mush.
7. **Paper cuts**: settings backdrop full-bleed; compass mode is a switch;
   copy says what a tap does; inset ×s 60 px; the reveal swing trimmed
   45°→35° so the bank rotates ~22% slower at the same altitudes.

## Verified, not changed

- The startup band angle, again (round 13 verified it too): at Indianapolis
  on a July EVENING the ecliptic peaks at 29–38°; at noon, 74°. The band IS
  low after sunset — that's the season and the hour, not a wrong coordinate.
  With decisions 1–2 the coordinates are now provably the device's own.

## Consequences

- First-run tile downloads grow to ~144 (7×16 day + 2×16 night, ~4.5 MB),
  Cache-API cached as before. Two more runtime tile hosts would be a privacy
  change, but GIBS was user-requested; it is disclosed in the chip copy,
  credits, and the imagery credit line.
- 104 unit tests and 44 e2e green; verified live: no-reload location moves
  (Indy↔NYC at altitude, patches rebuilt in place), night pyramid at 30/221 mi
  (city glow over readable streets), 1,380 mi night globe, edge arrows
  pointing the correct way, full-bleed settings.
