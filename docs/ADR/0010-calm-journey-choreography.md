# 0010 — calm journey choreography, plane guides, units, phone look

- Status: accepted
- Date: 2026-07-13

## Context

Live user feedback on the deployed journey: the view kept the ground frame
too long ("stuck in stone"), the Earth–Moon framing arrived with a jarring
gaze swing, the inner-system band "spun around weird" while the camera swept
its aim from the Moon midpoint over to the Sun, the observer's dot appeared
far too late to anchor the pull-out, whole Earth looked "perfectly straight
up" rather than tilted against the solar system's plane, the short
sunlight-direction ray read as a broken orbit line, there was no hint of the
ecliptic at ground level, distances showed kilometres to a miles audience,
and pointing the phone at the sky did nothing (compass mode was yaw-only).

## Decision

1. **Look down early, then never re-aim.** The guided gaze sweeps from the
   horizon to the nadir by the atmosphere landmark (composition anchors
   `{0→0, 0.06→0.05, 0.15→0.55, 0.24→1}`) and stays pinned on Earth for the
   entire rest of the journey. The Earth–Moon and system framings are
   **FOV-only** (`FramingWiden`): the Moon and then the whole ecliptic disc
   enter the frame because the field widens (≤100°, →78° at system scale),
   never because the camera turns. At 53 AU the Sun sits within ~1° of Earth,
   so the final view is Sun-centered by geometry, with zero spin. The
   observer's dot reveals at 1.5–30 km so "that is where I stand" anchors
   the rest.
2. **Ecliptic roll completes by whole Earth** (log-altitude 5 → 7.3, was
   →8.69 → originally →11.2): the world turns beneath you through low orbit,
   and whole Earth arrives visibly tilted against an already-flat plane.
   With the gaze pinned and free-look offsets unwinding during travel, the
   arrival orientation is repeatable from any starting view.
3. **The plane is visible at every scale.** A subtle ecliptic great circle on
   the star shell (the arc the Sun, Moon, and planets ride) shows from the
   ground up, fading as the heliocentric rings and orbit lines take over;
   Earth's own orbit line (192 samples, slightly brighter/warmer than the
   planet orbits) joins the heliocentric layer; the short sunlight ray
   retires over 1–6×10⁹ m so it can no longer read as a truncated orbit.
   All gated by the existing layer toggles ("Ecliptic plane", "Planet
   orbits", "Sunlight direction").
4. **Region-detected units.** `Intl.Locale(...).maximize().region` over
   `navigator.languages`: US/GB/LR/MM read miles (feet below one mile),
   everyone else kilometres; AU is universal at astronomical scale.
   `?units=mi|km` overrides for reproducible captures. Formatters take an
   explicit unit; a session singleton is set once at startup.
5. **Phone look.** Device orientation now drives pitch as well as heading:
   the through-the-screen gaze is derived from the W3C Z-X'-Y'' rotation —
   its up-component is `−cosβ·cosγ`, independent of α, so pitch stays valid
   on iOS where α is relative and `webkitCompassHeading` supplies the yaw.
   Still opt-in from the observer chip ("Point with phone"), still yielding
   to drag, per SPEC §9/§24.

## Consequences

- The low-orbit and whole-Earth views are now straight-down compositions;
  the horizon-at-low-orbit reading lives between ground and atmosphere.
- e2e text assertions pin en-US miles (headless Chromium locale); `?units=km`
  keeps km captures reproducible.
- The Moon can sit near the bottom screen edge at Earth–Moon scale on
  portrait (under the debug card in test scenarios) — marker activation
  falls back to the keyboard path there.

## Verification

- `camera.test.ts`: nadir-by-atmosphere anchors, roll band 5→7.3, FOV-only
  framings, miles/feet/AU formatting; `feature-flags.test.ts`: locale
  detection and `?units=` override; `compass-mode.test.ts`:
  through-the-screen pitch (flat → −90°, upright → 0°, tipped → +45°,
  landscape → 0°) and iOS heading path; `solar-system.test.ts`: Earth orbit
  line within 0.975–1.02 AU and <0.1° ecliptic latitude. 83 unit tests.
- Live Playwright CLI: observer dot centered at 100 km; whole Earth tilted
  with N. America on the side; Earth–Moon a clean level circle with no
  arrival swing; ground sky shows the ecliptic band with the Moon riding
  ~6° off it (inclination + parallax, physically consistent); synthetic
  `deviceorientation` events (α180/β135) eased the camera to heading ~180°
  pitched +45°.
