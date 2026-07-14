# 0012 — wayfinding, welcome, and surface honesty

- Status: accepted
- Date: 2026-07-13

## Context

Third round of live narration: the plane captions rode the top edge of the
band, too small and too sparse; nothing marked where the Sun went down or
would come up; the low-orbit → whole-Earth leg was "confusion and chaos"
(the arc started while the ground still filled the frame, and the satellite
imagery is below native resolution up close); the distance readout updated
too slowly; "Altitude · 7 ft" ignored real ground elevation; the final frame
cut Pluto's orbit; the Moon had no surface imagery; a design-doc sentence
leaked into the Moon inset; phone look was buried in the location panel;
"How to move" occupied the header while the title said only "On Earth"; the
rail's tick marks were thin and off-center and its labels never got out of
the way.

## Decision

1. **Captions in the band.** "Plane of the solar system" now sits centered
   in the ±1.5° band, larger, at four ecliptic longitudes (10°/100°/190°/
   280°) so the visible horizon usually carries two or three.
2. **Sunset & sunrise glows.** `computeSunHorizonEvents` (SearchRiseSet ±
   half-day window, refreshed every 10 minutes) drives two additive horizon
   sprites: warm orange where the Sun set, yellow-into-blue where it rises.
   Visible dusk-through-dawn at ground scales, faded by 120 km; null in
   polar day/night.
3. **Calmer middle.** The reveal arc starts at low orbit (log-altitude
   5.7 → 7.3) so the early ascent is a plain straight rise; and the globe
   material blends to a clean stylized tone below 800 km (fully textured by
   3,000 km) so the blurry close-up imagery never fills the frame — the
   terminator stays physical in both modes.
4. **Honest numbers, live.** The readout element updates every frame from
   the render loop (direct DOM; React keeps the slow fallback), and altitude
   rows add the observer's ground elevation from the place catalog (GeoNames
   `dem`, new `Int16Array` column) — Indianapolis opens at ~820 ft, not 7 ft.
5. **80 AU.** Journey max is 1.2×10¹³ m so Pluto's entire orbit (aphelion
   49 AU) frames with margin; the stage-two render scale end derives from it.
6. **A lunar surface.** NASA CGI Moon Kit (LRO) albedo on the physically-lit
   Moon mesh, tidally locked (near side faces Earth, `up` = ecliptic pole,
   libration ignored per ADR-0009); flat shading stays the fallback. Planets
   remain magnitude-scaled points (SPEC §13.4 — no resolved disks).
7. **A welcome, not a manual.** First plain visits get an intro dialog
   (what this is, drag/scroll/tap, the phone-look toggle, reduced motion);
   `?time`/`?lat` capture URLs and returning visitors skip it; the header's
   "?" reopens it. Phone look is a single shared session (`togglePhoneLook`,
   store-backed) used by both the dialog and the location panel. The header
   kicker is the app's name and the H1 is the live landmark label.
8. **Rail polish.** Ticks straddle the 2 px rail at its own thickness;
   landmark labels appear while traveling (or on hover/focus) and fade at
   rest; the rail is truly vertically centered.

## Consequences

- e2e heading/help assertions moved to "Ground" and "About & how to move";
  ground-altitude assertions include elevation ("Altitude · 820 ft").
- The full-system aria is now "80.22 AU"; phase-four polls > 1.19×10¹³ m.
- The opening chip article was corrected ("Facing Arcturus", but still
  "Facing the Moon/Sun").

## Verification

- 91 unit tests, including sunset/sunrise azimuth bands for July at
  mid-northern latitude and a polar-day null, Indianapolis catalog elevation
  bounds, the delayed arc band, and the re-anchored journey map.
- Live Playwright CLI: intro on a plain first visit and absent on capture
  URLs; "Ground / Altitude · 250 m" (820 ft in miles regions) at Indy;
  labels fade at rest; band caption centered; textured Moon lit by the true
  Sun.
