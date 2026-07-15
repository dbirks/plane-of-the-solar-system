# 0017 — straight to the ball, Pluto's heart, pinch to travel

- Status: accepted
- Date: 2026-07-15

## Context

Ninth round of live narration. The atmosphere and low-orbit stops "do
nothing"; the reveal should begin around a thousand feet with the blue dot
showing almost immediately, and the whole-Earth frame should hold the
observer front-ish (about 45° around, facing the camera) rather than 70°
off. The below-horizon dashed band was invisible in daylight. Sky circles
were "comically big" and the Sun didn't need one. Settings wanted to be
full-screen with a bigger pinned X; insets wanted circular × buttons. The
axis stubs ignored their (different) toggle. Mars deserved a season line;
Pluto deserved its heart; markers near the rail lost taps; and pinch-to-zoom
was requested. Street-level imagery near the ground was floated — deferred:
fetching map tiles around the user's coordinates would send their location
to a tile server, which the privacy promise ("nothing is sent anywhere")
forbids; if it ever lands it must be an explicit, clearly-worded opt-in.

## Decision

1. **Straight to the ball.** The Atmosphere and Low-orbit landmarks are
   gone. Anchors: whole Earth 0.22, Earth–Moon 0.42, inner 0.72. The reveal
   runs log-alt 2.5 → 6.3 (≈300 m → 2000 km) — the camera starts swinging
   almost as soon as the ground lets go — and the observer dot fades in
   from 250 m. `OBSERVER_SWING_RAD` drops to 45°: the dot rides the tilted
   globe's front, facing the camera.
2. **Daylight-aware band.** Band and dash opacity scale up to ~2.2× while
   the Sun is up (the fixed 0.14 was tuned at night and vanished against a
   daytime sky).
3. **Insets.** Circular × close buttons; Pluto uses the New Horizons global
   mosaic (PIA11707, NASA/JHUAPL/SwRI, public domain — the heart is
   center-face; the unimaged southern hemisphere stays black, honestly);
   Mars shows its current season from the areocentric solar longitude
   (Allison & McEwen approximation, unit-tested against the MY36 equinox).
4. **Settings full-screen**, readable column, X fixed to the viewport's
   top-right; axis stubs got their own default-on "Earth tilt" switch
   (the full axis+equator guide keeps its separate toggle).
5. **Pinch-to-zoom.** Two captured pointers pause free-look and travel the
   journey logarithmically by the ratio of pinch separations.
6. **Rail taps.** The invisible range input narrowed 44 → 26 px so canvas
   taps just left of the rail reach the markers again.
7. Sky circles shrank to 18 px and the Sun keeps none (its disc and glow
   already mark it).

## Consequences

- The rail has five stops; e2e fills use 0.22/0.42; the screenshots spec
  captures four landmark frames plus ground.
- 99 unit tests (Mars Ls quadrants pinned).
- Pinch and rail-tap behavior still deserve an on-device pass.
