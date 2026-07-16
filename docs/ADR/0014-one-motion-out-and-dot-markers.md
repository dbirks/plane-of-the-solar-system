# 0014 — one continuous motion out, dot markers, and glows that keep time

- Status: accepted
- Date: 2026-07-14

## Context

Sixth round of live narration: the pull-out flashed and "changed directions,
jarringly" between the atmosphere and low orbit, and the roll read as
spinning the wrong way; the sunrise glow showed in the middle of the night;
the ecliptic band was suspected wrong ("super low, like wintertime"); the
"Plane of the solar system" caption popped off the moment its anchor left
the frame; the band appeared to end at the horizon; edge-pinned markers were
anonymous; ring markers drew circles around bodies that were plainly visible
(the whole Earth, the near Moon); the chip still opened with "Facing
Arcturus" in yellow; the phase inset looked low-quality with confusing white
on one limb; cardinal directions kept sliding at planetary scales.

## Decision

1. **One motion out.** `cameraArcBlendForAltitude` now shares the roll's
   whole band (log-alt 5 → 7.3): the reveal arc and the ecliptic roll run in
   lockstep from the atmosphere to whole Earth and nothing new starts at low
   orbit. This also fixes the flash at its root: previously the roll acted
   alone on a nadir gaze — a pure screen-spin whose shortest-path angle is
   ±180°-ambiguous straight down, so its sign could flip frame to frame.
   With the arc underway the gaze leaves the nadir immediately and the
   projection is well-conditioned. As a belt-and-braces guard the renderer
   also unwraps the roll angle against the previous frame, so the roll can
   never reverse direction mid-journey.
2. **The band was right.** Unit tests now pin the sky-shell ecliptic band to
   astronomy-engine: over Indianapolis on a July evening it tops out near
   30° (January evening: ~71°), and the Sun sits on the band at every fixed
   epoch. Summer _nights_ genuinely have a low ecliptic — the "wintertime"
   look is the sky, not a bug.
3. **Glows keep time.** `SunHorizonEvents` carries event times; each glow is
   gated by its own window (sunset: ~30 min before to ~60 min after; sunrise
   mirrored) with 15-minute shoulders. The all-night dusk factor is gone.
4. **The band loops.** A dotted below-horizon continuation (every third
   high-res segment whose endpoints sit below the local horizon, depth test
   off) draws through the ground and hands off as the ground fades (20–120
   km). Captions now ease out past the screen edge (soft NDC fade to ~1.3)
   instead of popping at 0.92.
5. **Dot markers.** Rings are gone. Markers are 6-px dots with labels; a
   body whose disc is plainly visible (apparent radius > 0.175°, on-frame,
   above the horizon) drops the dot and keeps only the label — no circle
   around the whole Earth or the near Moon, while the Sun, Mars, and every
   planet get a visible dot at system scale (Earth's is pale blue).
   Edge-pinned markers keep a small label naming what lies off-screen, and
   labels flip above the dot near the bottom of the frame. Overrides carry
   `apparentRadiusDeg` from true camera distances.
6. **Grounded chip, quieter header.** The chip reads "Near <city>" only, in
   the blue accent; the scene dot is brighter blue inside a darker back-face
   rim and retires over 1.2–4×10⁸ m (by Earth–Moon). The header "?" is now
   an inlined Lucide sliders icon. The compass ribbon fades over 1–6×10⁶ m
   where cardinal directions stop meaning anything.
7. **A real phase disc.** The inset draws the NASA LRO nearside (central
   square of the equirectangular map) at device pixel ratio, fully in faint
   earthshine with the lit region re-drawn through a single terminator path
   (limb half + half-ellipse). The white limb the narration flagged was the
   true waning crescent; it now looks like the Moon.

## Consequences

- The journey has exactly two camera phases: gaze sweep to nadir (ground →
  atmosphere), then one combined arc+roll (atmosphere → whole Earth).
- 94 unit tests; the arc/roll lockstep is asserted numerically.
- Marker CSS class `sky-marker-ring` is renamed `sky-marker-dot`; e2e
  selectors for the chip use "Near Indianapolis, IN".
- The below-horizon band rebuilds ~1 Hz with the astronomy tick (480 max
  segments, negligible cost).
