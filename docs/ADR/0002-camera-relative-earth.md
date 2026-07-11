# ADR 0002: Camera-relative Earth with adaptive render scale

- Status: Accepted
- Date: 2026-07-11

## Context

The camera must travel from two meters above a 6,371 km Earth to a 20,000 km whole-Earth composition without visible meter-scale jitter. A single world-space meter scale would send large absolute values to the GPU and waste depth precision.

## Decision

Keep canonical camera altitude and Earth radius as double-precision meters. Keep the Three camera at the render origin. Each frame, position Earth relative to that origin and choose a uniform render-units-per-meter scale that keeps scene magnitudes bounded. Use a near-surface precision cap representation while very close to the ground and crossfade into the global sphere as altitude rises.

The logical journey is logarithmic in meters and is integrated using a stable damped spring. Camera orientation is quaternion-derived from a scale-dependent guided composition plus user drag offsets. Reversed depth is the default experiment, with `standard` and `log` query overrides.

## Consequences

Canonical truth never enters Three.js data structures, GPU coordinates stay well-conditioned, and the global Earth can retain true proportions. A local cap is a second render representation and must share visual parameters with the sphere to avoid a visible seam.

## Verification

Numeric tests cover the logarithmic mapping and spring stability. Fixed-browser scenarios capture the near surface, transition, and whole-Earth views while debug telemetry records clipping and estimated jitter.
