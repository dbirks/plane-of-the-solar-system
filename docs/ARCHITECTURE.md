# Architecture

The application has five runtime boundaries:

1. React renders controls, accessibility summaries, and debug/readout panels. It never runs per-frame work.
2. Zustand stores user targets and publishes low-frequency state from the renderer: telemetry (~5 Hz) and the astronomy sky readout (~1 Hz).
3. Pure TypeScript coordinate, camera, astronomy, simulation, and location modules hold canonical values in meters and degrees and do not import Three.js:
   - `src/astronomy/sky-state.ts` wraps astronomy-engine into immutable per-second `SkyState` snapshots (topocentric alt-az, distances, angular radii, Moon illumination, and the EQJ→local-Three rotation for the star field).
   - `src/astronomy/opening-target.ts` scores the deterministic opening view (SPEC §11.2).
   - `src/location/observer-location.ts` resolves the offline observer-location chain (ADR-0006).
4. `SpaceRenderer` owns Three.js, input-to-camera composition, the `SimulationClock`, and the animation loop. It recomputes the astronomy snapshot about once per simulated second and feeds it to the sky layer and overlay.
5. `SkyOverlay` (`src/ui/sky-overlay.ts`) is renderer-driven DOM: screen-space markers for the Sun, Moon, and bright planets (ghosted below the horizon, edge-pinned when off-view) plus the sliding compass strip. Markers are pointer-transparent; the canvas routes short still taps back to the overlay for hit-testing, so dragging works everywhere. React renders only the static skeleton (`CompassRibbon` ticks, overlay root).

The scene uses one logical Earth with a global sphere and a near-surface precision representation, both camera-relative. The Phase 2 sky is a camera-anchored celestial shell: a 2,865-star point cloud in EQJ rotated per time and observer, the Sun disc and glow at true angular size, the Moon as a sky-proxy sphere shaded by the real Sun direction (the terminator is physical geometry, not a texture), and bright planets as magnitude-scaled points. Scene sunlight, sky brightness, atmosphere opacity, and star visibility all derive from the true Sun altitude.

Time is the live current time unless a reproducible `?time=` parameter pins it; the `SimulationClock` runs at rate 1 and supports pause/rate for later phases.
