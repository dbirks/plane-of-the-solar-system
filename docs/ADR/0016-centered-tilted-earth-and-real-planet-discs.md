# 0016 — centered tilted Earth, real planet discs, paranoid compass

- Status: accepted
- Date: 2026-07-15

## Context

Eighth round of live narration, on a fresh phone visit. The whole-Earth
composition changed direction again: not the anti-sunward "Earth on the
right" but Earth CENTERED, on a visible tilt against the flat plane, the
observer's dot on its side, with a hint of the spin axis. Ground →
atmosphere had "no noticeable change"; compass mode still spun wildly
tracing the sky upward; the Moon inset showed a full disc at new moon on
the phone; planet insets had no imagery; the settings dialog scrolled its
own X away; guides were tiny checkboxes with no explanations; credits
rendered as one run-on line; markers needed softer treatment in the sky and
label-above arrows in space; orbit lines looked blocky up close; the
below-horizon band went unnoticed.

## Decision

1. **Centered, tilted Earth.** The reveal vantage is anchored on the
   OBSERVER, not the Sun: the zenith is projected into the ecliptic plane
   and swung `OBSERVER_SWING_RAD` (~70°) about ecliptic north, lifted
   ~8.5° (`REVEAL_NORTH_LIFT`). The gaze goes straight to Earth's center
   (screen offset removed). Small default-on **axis stubs** above and below
   the poles fade in with the reveal and out with systemReveal, so the tilt
   against the already-flat plane is explicit. Day or night side is
   whatever the hour gives — the Sun no longer steers the frame.
2. **Faster early journey.** Anchors re-tuned: atmosphere 0.12, low orbit
   0.18, whole Earth 0.3, Earth–Moon 0.48, inner 0.76. The quiet
   ground-to-ball leg now spends less than a third of the slider.
3. **Paranoid compass calibration.** The on-device flip survived round 7
   because the magnetometer reference itself (webkitCompassHeading /
   absolute alpha) can branch-flip 180° as the device tips past upright —
   an artifact of the Euler decomposition, not a real turn — and the yaw
   calibration chased it within a third of a second. Now: only one event
   stream is honored (absolute wins when both fire — Android sends both),
   the calibration samples only near-level attitudes (|gaze pitch| < 30°),
   tracks at 0.03/event, and REJECTS any correction jump over ~40° unless
   it persists ~2 s (a genuine re-reference). `?compassdebug=1` renders a
   live sensor overlay for on-device screenshots.
4. **Safari broke the phase disc.** `CanvasRenderingContext2D.filter` is
   unsupported in Safari, so the Moon inset's night-side dimming silently
   no-oped — a new Moon rendered as a full disc. The shared `phase-disc.ts`
   dims by filling the night hemisphere region (single limb+terminator
   path) with a translucent dark instead. The Moon inset and the new planet
   insets both use it.
5. **Real planet discs.** The selection inset draws each planet's facing
   hemisphere from bundled Solar System Scope maps (CC BY 4.0, 1024×512,
   364 KB total; Pluto falls back to a tint) with the physically correct
   phase: illuminated fraction from astronomy-engine, lit limb toward the
   Sun's side of the sky. Venus shows its true crescent/gibbous; Jupiter is
   effectively always full. Scene rendering stays true-size only.
6. **Marker triage by regime.** In the sky view (below ~400 km) on-screen
   bodies wear a big soft muted circle; in space the pointer arrow carries
   its label ON TOP, pointing down at the body; edge arrows still rotate
   toward their body; ghosts keep hollow circles.
7. **UI.** Header buttons are circles (42 px), with a compass toggle beside
   settings. The settings dialog pins its title row and X while only the
   body scrolls; guides are switch rows with one-line descriptions; credits
   are separate lines with links that open in new tabs. The intro offers
   "Point with your phone" (triggering the motion-permission prompt from
   the tap, as iOS requires) beside a plain Continue, and a Screen Wake
   Lock keeps the display on while stargazing where supported.
8. **Sharper lines, louder dashes.** Orbit samples 192 → 512 (rings 128 →
   360); the below-horizon band dashes densified (every 2nd segment) and
   brightened ~2.4× over the band fill.

## Consequences

- e2e anchor fills updated (0.3 for whole Earth etc.); screenshots spec
  captures the new anchors; settings specs target the switch inputs via
  their row labels.
- 97 unit tests; compass behavior still needs on-device confirmation —
  the debug overlay exists for exactly that.
- New assets documented in docs/ASSETS.md; credits list Solar System Scope.
