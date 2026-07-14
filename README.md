# Plane of the Solar System

An immersive experience that begins about two meters above Earth under the real current sky, and lets you pull continuously outward until the horizon becomes the limb of a whole planet.

**Live app:** [dbirks.github.io/plane-of-the-solar-system](https://dbirks.github.io/plane-of-the-solar-system/)

All six phases of `SPEC.md` (0–5) are implemented: the precision ground-to-whole-Earth journey, the real sky, the Earth–Moon system, the full solar system to Pluto, and the experience layer — all at true scale.

## What works

- **The real sky for your place and moment**: the Sun, Moon, bright planets, and 2,865 catalog stars occupy their true directions, computed by astronomy-engine and cross-validated against an independent Meeus reference
- The Moon shows its actual phase — the terminator is physical geometry lit by the true Sun direction, never a texture
- A deterministic opening view: the camera greets you facing the Moon, the setting Sun, a bright planet, or a bright star
- Screen-space markers with click-to-look for every bright body, ghosted below the horizon, edge-pinned when off-view
- A live sliding compass, day/twilight/night sky driven by true Sun altitude, stars that emerge through dusk, and **sunset/sunrise glows on the horizon** marking where the Sun went down and where it returns
- A **first-visit welcome dialog** (how to look, zoom, and point your phone at the sky); the header title tracks your landmark live, and altitude readouts include your real ground elevation
- The pull-out looks down at **your own blue dot** from the first kilometres up, then the camera **arcs around the planet** to an anti-sunward vantage: Earth stands alone with your dot on its side and the Sun, Mercury, and Venus in the background, day or night, while the gaze never leaves Earth
- From whole Earth out, **dragging orbits you around the planet** (Earth stays centered, like turning a globe) instead of panning the view; an Earth marker with top label priority joins the system-scale sky
- Keep pulling out to the **Earth–Moon landmark at 500,000 km (310,686 mi)**: the physical Moon at true, uncompressed distance, its real orbit traced around Earth, and a sunlight-direction guide — with a jump-free hand-off from the sky view
- Click the Moon for an inspection inset: phase disc, phase name, illuminated fraction, and distance, always matching the scene geometry
- Continue out to the **inner system (2.7 AU)** and the **full solar system (80 AU)**: every planet to Pluto at its true current position and radius — Pluto's whole orbit inside the final frame — riding precomputed orbit lines, with faint ecliptic rings making the plane of the solar system visible
- On the way out, the view **rolls from your local "up" onto the plane of the solar system** — starting as the atmosphere gives way to space and complete by whole Earth, which arrives visibly tilted against an already-flat ecliptic, revealing that you were standing on the side of a planet
- The **plane of the solar system is drawn at every scale**: a labeled ecliptic band across the real sky from the ground (the strip the Sun, Moon, and planets ride, captioned "Plane of the solar system"), Earth's own orbit line around the Sun, and the faint ecliptic rings at system scale
- Select any body's marker for distances and magnitude; nothing is ever enlarged — markers carry the discoverability
- **NASA Blue Marble** Earth with **Black Marble city lights** on the physically-lit night side, and the **NASA LRO lunar surface** on the physically-lit Moon (async-loaded, attributed); up close the globe holds a clean stylized tone until the imagery is at native resolution
- A Layers panel for optional explanation geometry: orbits, ecliptic rings, Moon orbit, sunlight direction, Earth axis & equator, sky grid, labels — sparse by default
- Marker labels declutter automatically when bodies crowd; adaptive pixel-ratio under sustained slow frames
- **Compass mode**: opt-in device orientation drives both heading and pitch, so aiming your phone at the sky looks there
- Distances read in **miles or kilometres by your device's region** (US/GB/LR/MM get miles; `?units=mi|km` overrides); astronomical distances stay in AU
- Offline location chain (URL → saved → timezone guess → fallback) with a picker for manual coordinates and opt-in device location — never a permission prompt on opening; the chip shows a coarse "Near <city>" anchor (bundled GeoNames subset, matched on-device) instead of raw coordinates
- Direct Three.js `WebGPURenderer` with automatic WebGL 2 fallback and forced-WebGL mode
- Camera-relative rendering with canonical double-precision meter values; smooth, damped piecewise-logarithmic travel through ground, atmosphere, low orbit, and whole Earth
- Fixed time/location/debug controls, live precision/performance telemetry, and reduced-motion support
- 91 unit tests, 44 Playwright scenarios (desktop + mobile), and GitHub Pages deployment

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:4173/`.

Useful reproducible parameters:

```text
?debug=1
?renderer=auto
?renderer=webgl
?depth=reversed
?depth=standard
?quality=low
?time=2026-07-11T22:00:00Z
?lat=39.7684&lon=-86.1581
?units=mi (or km)
```

## Verify

```bash
pnpm check
pnpm test:e2e
pnpm build:pages
```

Interactive acceptance uses the current Playwright agent CLI:

```bash
pnpx @playwright/cli@latest open http://127.0.0.1:4173/
pnpx @playwright/cli@latest snapshot
pnpx @playwright/cli@latest screenshot
```

## Screenshots

| Ground                                              | Atmosphere                                                  | Low orbit                                                 | Whole Earth                                                   | Earth–Moon                                                  |
| --------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| ![Ground](artifacts/screenshots/desktop-ground.png) | ![Atmosphere](artifacts/screenshots/desktop-atmosphere.png) | ![Low orbit](artifacts/screenshots/desktop-low-orbit.png) | ![Whole Earth](artifacts/screenshots/desktop-whole-earth.png) | ![Earth–Moon](artifacts/screenshots/desktop-earth-moon.png) |

Mobile captures and debug evidence are also available in [`artifacts/screenshots/`](artifacts/screenshots/).

See [`docs/PRECISION_REPORT.md`](docs/PRECISION_REPORT.md) for measured results and known limitations, and [`docs/ADR/`](docs/ADR/) for technical decisions.
