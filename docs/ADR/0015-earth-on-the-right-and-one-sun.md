# 0015 — Earth on the right, one sun, arrows that point

- Status: accepted
- Date: 2026-07-14

## Context

Seventh round of live narration. The pull-out still read as three separate
moves (tilt by the atmosphere, a sudden re-aim at low orbit, then the zoom),
and the user articulated the composition they actually wanted: "orient the
plane of the solar system to be flat [early] ... have the plane in the
background on one side, and then have the earth be on the right side of the
screen with your little blue glowing chip." Between roughly 2 and 4 million
miles out, TWO suns showed during the proxy→physical crossfade. Pluto's
orbit "drew itself in a sweeping motion" near 0.2–0.3 AU. Dot markers read
as body sizes ("Mercury is huge") and yellow read as "everything is the
sun". Compass mode "flips around and does this crazy spin" tracing the band
up through the zenith. The header carried a separate Layers button; compass
mode sat oddly inside the location chip; the intro over-explained.

## Decision

1. **One slerp, Earth on the right.** `revealBlendForAltitude` (log-alt
   4 → 6.6) replaces the composition-pitch/arc/roll trio. The base frame is
   a single slerp from the ground's free-look frame to a target built with
   `Matrix4.lookAt`: up = ecliptic north (the plane lies flat across the
   background), gaze = Earth's direction yawed by `EARTH_SCREEN_OFFSET_RAD`
   (0.32 rad) so the planet stands right of center with the observer's dot
   on its side. The vantage's ecliptic latitude dropped from ~24° to ~8.5°
   (`REVEAL_NORTH_LIFT` 0.15) so the plane reads as a line, not a disc. The
   gaze never detours to the nadir; nothing new starts at low orbit; the
   offset eases back to center with systemReveal so the 80 AU frame stays
   centered. Roll-angle unwrapping is gone — a slerp between two frames has
   no shortest-path ambiguity to flip.
2. **One sun.** Two causes, both fixed. (a) The sky proxies (Sun disc, glow,
   planet points) sat at the GROUND observer's directions on the
   camera-anchored shell; millions of kilometres out, parallax separated
   them from the physical bodies fading in. They now follow rays computed
   from the camera's true position every frame. (b) astronomy-engine's
   "normal" refraction lifts bodies ~0.55° even 14° below the horizon, and
   that refraction was baked into the reconstructed geocentric positions.
   `SkyBodyState` now carries `directionLocalThreeAirless`; the geocentric
   reconstruction uses it, and the proxies blend refracted → geometric over
   1–10×10⁶ m (the Moon placement's existing band). Always-on heliocentric
   rendering remains off the table: the two-stage render scale exists so a
   2 m eye height and 80 AU fit one depth buffer (ADR-0004).
3. **No orbit sweep.** The "drawing itself" was far-plane clipping: at
   0.2 AU only ~31 of Pluto's 49 AU fit inside the fixed 50k-unit far
   plane. Once systemReveal is live, the far plane stretches to hold
   Pluto's aphelion (near scales with it, so depth precision is unchanged);
   everything beyond the old far plane is transparent when the gate flips.
4. **Arrows, not dots.** Markers are small neutral arrows whose TIP rests on
   the body — pointing at a position suggests no size and no sun-yellow.
   Edge-pinned markers rotate to point off-screen toward the body
   (`--edge-rotation`); below the horizon they relax to the hollow circle;
   resolved discs keep label-only; Earth's arrow is blue.
5. **Compass mode through the zenith.** Full device attitude as a quaternion
   (the DeviceOrientationControls construction: YXZ euler, look out the
   back, screen-orientation compensation) in the local frame, with
   magnetometer yaw calibration low-passed and FROZEN above 60° pitch,
   where compass headings degenerate. The renderer slerps the camera to it
   directly — heading+pitch decomposition (gimbal-locked at the zenith) is
   now only a fallback. Free-look offsets stay synced so exiting never
   jumps.
6. **One dialog.** The header's sliders icon opens a Settings dialog (X to
   close): how to move, "Point with your phone" (compass mode moved out of
   the location chip), a Guides section (the former Layers panel), and the
   data credits. The gentler-camera checkbox is gone — the OS-level
   prefers-reduced-motion preference still drives the spring. The intro is
   two sentences aimed at the perspective reset and a Continue.

## Consequences

- The journey is: free look on the ground → one continuous ease into
  "plane flat, Earth right" → pure zoom to 80 AU.
- 97 unit tests (attitude quaternion passes a through-the-zenith continuity
  sweep; the reveal blend is pinned monotonic with constants bounded).
- Six caption anchors ride the band, including its below-horizon stretch
  (dimmed to match the dotted continuation).
- e2e selectors: "Settings" button and dialog; "6 tex" stays (glow-window
  behavior unchanged).
