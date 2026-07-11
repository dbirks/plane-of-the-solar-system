# Plane of the Solar System

An immersive precision prototype that begins about two meters above Earth and lets you pull continuously outward until the horizon becomes the limb of a whole planet.

**Live app:** [dbirks.github.io/plane-of-the-solar-system](https://dbirks.github.io/plane-of-the-solar-system/)

The current `SPEC.md` task deliberately implements Phase 0 and Phase 1 only. Astronomy is not rejected: Sun, Moon, planets, and stars are explicitly planned for later phases, but the spec gates them on proving this ground-to-whole-Earth precision foundation first.

## What works

- Direct Three.js `WebGPURenderer` with automatic WebGL 2 fallback and forced-WebGL mode
- Camera-relative rendering with canonical double-precision meter values
- Smooth, damped piecewise-logarithmic travel through ground, atmosphere, low orbit, and whole Earth
- Drag look, mouse wheel, touch-friendly vertical slider, landmark buttons, and keyboard slider operation
- Near-surface precision representation, observer marker, basic atmosphere, responsive portrait composition, and reduced-motion option
- Fixed time/location/debug controls and live precision/performance telemetry
- Unit, browser, visual-capture, and GitHub Pages deployment workflows

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

| Ground                                              | Atmosphere                                                  | Low orbit                                                 | Whole Earth                                                   |
| --------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| ![Ground](artifacts/screenshots/desktop-ground.png) | ![Atmosphere](artifacts/screenshots/desktop-atmosphere.png) | ![Low orbit](artifacts/screenshots/desktop-low-orbit.png) | ![Whole Earth](artifacts/screenshots/desktop-whole-earth.png) |

Mobile captures and debug evidence are also available in [`artifacts/screenshots/`](artifacts/screenshots/).

See [`docs/PRECISION_REPORT.md`](docs/PRECISION_REPORT.md) for measured results and known limitations, and [`docs/ADR/`](docs/ADR/) for technical decisions.
