# 0013 — orbit drag, grounded wayfinding, and a calmer chip

- Status: accepted
- Date: 2026-07-13

## Context

Fifth round of live narration: dragging at planet/system scales panned the
gaze from a fixed point when "spinning the world around Earth" was expected;
the sunset/sunrise glows were camera-facing sprites that floated as
screen-aligned ovals instead of lying on the horizon; the marker rings sat
visibly right of the bodies (the ring centered on the label's width, not the
anchor); there was no Earth marker at system scale and the Moon's label
outranked where the viewer actually lives; the plane captions followed the
journey out where they were no longer needed; the per-frame readout made the
whole line vibrate; AU showed false precision; the intro copy read like AI
and used em dashes; the chip panel was a jumble that overflowed phone
viewports; ground→whole-Earth still dragged.

## Decision

1. **Orbit drag.** Beyond the atmosphere the drag offsets are consumed as a
   rotation of the whole base frame about Earth's center (yaw about the
   blended screen-up axis, pitch about screen-right), blended by the arc
   band so drag feel is continuous: pure free-look on the ground, pure
   Earth-centered orbit from whole Earth out. The unconsumed share still
   applies as free look, so total gaze change per pixel is identical at
   every blend. Scale travel keeps unwinding the offsets to the canonical
   vantage.
2. **Horizon-true glows.** The sunset/sunrise glows are quads fixed in the
   local sky frame, tangent to the horizon at the event azimuth: they tilt
   and foreshorten with the actual edge of the sky.
3. **Anchored markers.** `.sky-marker` is a zero-size anchor; the ring and
   label position absolutely around the exact projected point, so rings
   center on bodies regardless of label width. A synthetic **Earth marker**
   (label priority above all, magnitude −99) appears at system scale along
   the ray to Earth's render center; it is overlay-only (never a sky proxy,
   selecting it opens nothing).
4. **Captions stay grounded**: the "Plane of the solar system" text fades
   out above the atmosphere (1–3×10⁵ m); the band itself remains.
5. **Steady readout.** Label and value are separate spans in a fixed-width
   row (label pinned left, value right, the gap absorbs digit-width
   changes); the renderer updates only the spans' text. AU precision:
   tenths below 10 AU, whole numbers beyond ("80 AU").
6. **Plain words.** Intro rewritten ("This is tonight's actual sky…",
   Continue button, "Gentler camera (less motion)"), em dashes removed from
   user-facing strings, phone look renamed **Compass mode** everywhere, and
   the chip panel reorganized: Where you are (Use my location · Compass
   mode) / Or enter coordinates (inputs + Go here) / Remember this spot ·
   Forget, with inputs that fit phone viewports (e2e asserts the open panel
   fits).
7. **Faster early leg** (again): atmosphere 0.2, low orbit 0.26, whole
   Earth 0.36, Earth–Moon 0.52, inner system 0.78. The observer dot is
   maps-blue now.

## Verification

- 91 unit tests (re-anchored maps, AU precision cases, soft-attraction
  probe moved between the tighter anchors).
- Live Playwright CLI: a 250 px drag at whole Earth keeps Earth centered
  and swings the vantage (terminator rotates into view); the reorganized
  panel renders within a 360 px viewport; the readout row holds still while
  the value ticks every frame; ring centers sit on the Moon/planet dots.
