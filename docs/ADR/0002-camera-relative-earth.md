# ADR 0002: Camera-relative Earth with adaptive render scale

- Status: Accepted
- Date: 2026-07-11

## Context

The camera must travel from two meters above a 6,371 km Earth to a 20,000 km whole-Earth composition without visible meter-scale jitter. A single world-space meter scale would send large absolute values to the GPU and waste depth precision.

## Decision

Keep canonical camera altitude and Earth radius as double-precision meters. Keep the Three camera at the render origin. Each frame, position Earth relative to that origin and choose a uniform render-units-per-meter scale that keeps scene magnitudes bounded. Use a near-surface precision cap representation while very close to the ground and crossfade into the global sphere as altitude rises.

The logical journey is logarithmic in meters and is integrated using a stable damped spring. Camera orientation is quaternion-derived from a scale-dependent guided composition plus user drag offsets. Reversed depth is the default experiment, with `standard` and `log` query overrides.

The observer marker uses distance-relative render sizing so it remains discoverable without becoming a false physical body during ascent. Debug draw calls are derived as a per-frame delta from the renderer's cumulative counter. Coordinate guides remain hidden in Phase 1 because the initial WebGPU/WebGL line rendering obscured the Earth silhouette and they are not a Phase 1 deliverable. A single back-face atmosphere shell serves both inside and outside views; two overlapping transparent shells caused visible triangle-sorting bands in the WebGL fallback.

Whole-Earth composition derives its vertical field of view from viewport aspect ratio. Desktop keeps a 46° vertical FOV; portrait widens vertically enough to preserve a 36° horizontal field, capped at 76°. This keeps the true-size globe fully framed beside the vertical scale control without changing physical scale.

The control uses a piecewise-logarithmic perceptual map: 2 m at 0%, 1 km at 16%, 100 km at 38%, 500 km at 58%, and 20,000 km at 100%. Every interval remains logarithmic in physical meters, but the atmosphere no longer consumes two thirds of the usable control. Camera guidance begins during early ascent, and sky brightness now fades from 1 km through 180 km so the atmosphere boundary is visually legible. A scale input after free-look requests guidance until orientation offsets actually converge to zero, independent of whether the distance spring has settled. Starting a new drag cancels that request, so free look remains fully available at every scale. Both analytic spring integration and orientation damping cap long frames at 250 ms, so motion remains stable without stretching wall-clock travel on a loaded renderer.

Guided pitch uses separate perceptual composition anchors instead of one global easing curve. Atmosphere maps to 17% of the 90° pull-down, low orbit to 34%, and whole Earth to 100%. This keeps the curved Earth limb and black space simultaneously visible at 500 km before the camera accelerates toward the centered radial view.

A coarse code-native continent outline fades in during ascent. Its longitudes and latitudes are transformed through the documented Earth-fixed frame, then rotated so the fixed observer location maps to the near-side surface marker. The layer is depth-tested and slightly raised above the sphere, so far-side coastlines remain occluded and the outline does not change the physical Earth radius.

## Consequences

Canonical truth never enters Three.js data structures, GPU coordinates stay well-conditioned, and the global Earth can retain true proportions. A local cap is a second render representation and must share visual parameters with the sphere to avoid a visible seam.

## Verification

Numeric tests cover the logarithmic mapping and spring stability. Fixed-browser scenarios capture the near surface, transition, and whole-Earth views while debug telemetry records clipping and estimated jitter. CLI captures at the atmosphere and low-orbit landmarks verify the distance-relative marker does not occlude the surface.
