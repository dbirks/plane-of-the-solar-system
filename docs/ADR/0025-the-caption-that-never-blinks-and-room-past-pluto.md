# ADR-0025: The caption that never blinks, and room past Pluto

- Status: accepted
- Date: 2026-07-24

## Context

Round-18 on-device feedback (user delighted with the three-beat reveal):
the centered plane caption clipped out around 13,000 mi and back in around
30,000 mi; a wish for "a tiny bit more zoom" past 80 AU; the close button ×
STILL not right after four rounds (the text glyph cannot scale); a
dead-space hitbox around the rail's landmark labels that ate drags; and the
dot's background glow arriving before the solid dot. The user also observed
the Moon riding above/below the plane — and correctly guessed that's real
(5.1° orbital inclination; verified, not changed).

## Decision

1. **The lead caption slides, never hides.** While the globe fills the
   center, anchor 0 offsets along the band by
   `sqrt(max(0, (occluderRadius + 3)² − 8.5²))` — just enough to clear the
   caption occluder given the band's ~8.5° lift — easing to exactly 0
   (dead-center) as the planet shrinks. One caption, visible continuously
   from the reveal through system scale.
2. **Journey max 1.2e13 → 1.5e13 m (~100 AU).** The far-plane stretch now
   adds the camera altitude (`(plutoAphelion + altitude) · upm · 1.15`): an
   Earth-anchored constant alone would clip the orbit's far side at 100 AU,
   ~150 AU from the camera.
3. **Close buttons use an inline SVG cross** (22 px strokes in a 40 px
   circle; settings 24 px in 48 px). Four rounds of resizing were fighting
   the text glyph's ink-to-em ratio — a vector icon scales exactly.
4. **Rail labels take only their own taps**: the landmark-label overlay is
   `pointer-events: none` with buttons `auto` — the space between labels
   belongs to the canvas again.
5. **Dot and glow arrive together, lower**: reveal band 200–1,500 →
   120–500 m, and the glow follows reveal² so the soft haze can never
   precede the solid dot.

## Consequences

- 105 unit tests, 44 e2e green (full-system readout asserts "100 AU").
  Mobile screenshots: caption present at 12,629 / 24,431 / 30,117 mi (the
  old gap), Pluto's whole orbit unclipped at 100 AU, dot + glow together at
  2,096 ft over Monument Circle, proper big × in a 40 px circle.
- VERIFICATION LESSON: the Playwright CLI tab persists across targets — a
  sweep after a production check silently re-tested production. Always
  re-`open` the intended URL and confirm `document.scripts[0].src` before
  reading results.
