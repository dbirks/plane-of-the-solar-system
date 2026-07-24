# ADR-0024: One caption, one glow, one continuous night

- Status: accepted
- Date: 2026-07-24

## Context

Round-17 on-device feedback ("things are looking really nice... few more
changes"): a dead zone in the night pull-out around 700–1,000 mi where the
ball all but vanished; the ball→side swing (5,000→12,000 mi) still a touch
abrupt; the plane caption appearing TWICE on a phone when the user wanted
the wording plainly centered; the dot's glow reading white at the edges and
arriving later than the dot deserves; a question about the long yellow sun
line; and the inset close button — grown huge over three rounds of "bigger"
— when it was the × GLYPH that was too small all along.

## Decision

1. **Overlapped night handoff.** The stylized-tone hold now releases across
   the imagery fade-out (400 km → 1.2e6 m) instead of after it: the globe's
   textures (city lights included) arrive exactly as the patches leave.
   The sequential handoff (ADR-0022) was the right call when patch and
   globe lights misregistered; with both in mercator agreement (ADR-0023)
   the overlap is seamless and the invisible-ball gap is gone.
2. **Swing stretched to ~20,000 mi**: `vantageSwingBlendForAltitude` band
   log 6.9→7.5 (was 7.3). It now settles a little past the whole-Earth
   landmark — deliberately trading the old "settled by whole Earth"
   invariant for the slower slide the user asked for.
3. **One centered caption.** Anchors sit at the gaze's ecliptic longitude
   +[0, ±60, ±120, 180]; the caption occluder margin drops +6°→+2°. The
   center caption rides the band ~8.5° above the globe (the north lift) and
   is visible from ~30,000 mi out, dead-center, at any hour from anywhere.
   Below that the occluder hides it; the flanking-pair experiment is gone.
4. **Dot**: glow gradient is light blue throughout (the near-white core
   read as a white rim), and the reveal band tightens 250–4,000 m →
   200–1,500 m so the blue dot is fully there by ~1 mi up.
5. **Sun line fades along its length** (12 segments, vertex colors,
   brightness (1−t)²): it suggests "that way to the Sun" without barring
   the frame. (Answer to the user's question: yes — deliberate, it points
   at the Sun and meets the SUN edge pointer.)
6. **Inset close right-sized**: 44 px circle (Apple's minimum touch target)
   with a 2.1 rem ×. The three rounds of "bigger" were about the glyph.

## Consequences

- 105 unit tests updated (swing band), 44 e2e green. Mobile-viewport
  screenshots verified each change: night lights continuous at 957 mi,
  single centered caption at 49,602 mi, glowing dot at 5.1 mi over
  night-dimmed streets, swing still settling gently at 19,819 mi, faded
  sun line, right-sized inset ×.
- The whole-Earth landmark now arrives mid-swing (by design). If the stop
  ever needs a settled frame, revisit the band jointly with the landmark.
