# Architecture

The application has four runtime boundaries:

1. React renders controls, accessibility summaries, and debug/readout panels.
2. Zustand stores user targets and publishes low-frequency telemetry from the renderer.
3. Pure TypeScript coordinate, camera, and simulation modules hold canonical values in meters and do not import Three.js.
4. `SpaceRenderer` owns Three.js, input-to-camera composition, and the animation loop.

The Phase 1 scene uses one logical Earth with a global sphere and a near-surface precision representation. Both are camera-relative. No astronomical objects are intentionally present because `SPEC.md` gates them on successful precision validation.
