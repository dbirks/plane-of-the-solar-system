# Plane of the Solar System

Get a sense of how you're positioned on the side of a planet.

**Live:** [dbirks.github.io/plane-of-the-solar-system](https://dbirks.github.io/plane-of-the-solar-system/)

You start about two meters off the ground, under the real sky for your spot
and this exact moment — the Sun, the Moon, the bright planets, and a couple
thousand stars, all where they actually are. A soft band arcs across the sky:
the plane of the solar system, the strip everything rides. Some evenings it
hangs low and some middays it towers overhead. That's not a mood; that's the
season and the hour, and the app will tell you the number if you ask the
location chip.

Then you leave. The ground becomes a map of your own streets, the map becomes
a ball with a glowing dot where you stand — dead-center, facing you — and the
frame gently banks until the plane lies flat and the whole neighborhood of
worlds assembles around it, out to Pluto and a hundred AU. Nothing along the
way is enlarged, sped up, or staged. The Moon really is that small in the
sky, and really that far away. That's rather the point.

It works nicely on a phone, especially outside at night: turn on compass
mode and the view follows where you point. City lights after dark are the
real ones (NASA's VIIRS Black Marble), and the daytime streets are real
imagery too (Esri World Imagery), fetched only for your area and cached on
your device.

## The nerdy details

- **Spatial truth over spectacle** is the governing rule: true sizes, true
  distances, true directions, at every scale — discoverability comes from
  screen-space markers, never from scaling bodies up.
- The sky is computed by [astronomy-engine](https://github.com/cosinekitty/astronomy)
  (cross-validated against an independent Meeus implementation in tests) with
  the HYG star catalog; the ecliptic band's height over your horizon is
  pinned to it in unit tests.
- Rendering is direct three.js `WebGPURenderer` (WebGL 2 fallback) with
  camera-relative coordinates: the camera sits at the origin, canonical state
  lives in double-precision meters, and the near plane rides your altitude so
  a 24-bit depth buffer keeps sub-percent precision from 2 m to 100 AU.
- The journey is one logarithmic rail with a critically-damped spring; the
  reveal is choreographed in three beats (map → ball → plane) tuned across
  many rounds of on-device narration — the decision history lives in
  [`docs/ADR/`](docs/ADR/), one story per ADR.
- Privacy stance: your location never leaves the browser except to fetch map
  tiles for your area from the two disclosed providers (Esri; NASA GIBS).
  Device location is coarse on purpose (~1 km) and only ever requested from
  an explicit tap.
- 105 unit tests and 44 Playwright scenarios (desktop + mobile) run on every
  change; deploys go straight from `main` to GitHub Pages.

## Run it locally

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:4173/`.

Handy URL parameters for reproducible moments:

```text
?time=2026-07-11T22:00:00Z    a fixed instant
?lat=39.7684&lon=-86.1581     a fixed place
?units=mi                     or km
?debug=1                      live telemetry panel
?renderer=webgl               force the fallback backend
?quality=low                  gentler pixel ratio
```

And to check your work:

```bash
pnpm check        # typecheck + lint + unit tests
pnpm test:e2e     # the Playwright suite
```

## Screenshots

| Ground                                              | Whole Earth                                                   | Earth–Moon                                                  | Solar system                                                   |
| --------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| ![Ground](artifacts/screenshots/desktop-ground.png) | ![Whole Earth](artifacts/screenshots/desktop-whole-earth.png) | ![Earth–Moon](artifacts/screenshots/desktop-earth-moon.png) | ![Solar system](artifacts/screenshots/desktop-full-system.png) |

More captures live in [`artifacts/screenshots/`](artifacts/screenshots/),
measured precision results in
[`docs/PRECISION_REPORT.md`](docs/PRECISION_REPORT.md).

## Data & imagery

Sky: astronomy-engine (MIT) and the HYG star database (CC BY-SA 4.0).
Earth: NASA Blue Marble and Black Marble; night tiles from NASA GIBS (VIIRS).
Moon: NASA CGI Moon Kit (LRO). Planets: Solar System Scope textures
(CC BY 4.0); Pluto: NASA New Horizons (NASA/JHUAPL/SwRI). Places: GeoNames
(CC BY 4.0), matched on-device. Close-up imagery © Esri, Maxar, Earthstar
Geographics.
