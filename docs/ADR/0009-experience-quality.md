# 0009 — experience and quality (Phase 5)

- Status: accepted
- Date: 2026-07-12

## Context

Phase 5 delivers Earth imagery, the Layers panel, axis/equator and sky-grid
guides, marker collision handling, compass mode, performance adaptation, and
documented attribution — while keeping default overlays minimal and never
prompting on the opening path.

## Decision

1. **Committed NASA imagery, async swap.** Blue Marble (4096×2048) and Black
   Marble night lights (2048×1024), ~1.1 MB total, committed under
   `public/textures/` (no runtime third-party fetches; provenance in
   ASSETS.md). They load after the opening scene and swap the globe material;
   the code-native flat-shaded globe remains the fallback. The material is a
   TSL node material that mixes night lights into the dark side by the true
   Sun direction — the terminator is physical, matching the Moon's treatment.
   The globe shares `observerToZenithQuaternion` with the continent outlines,
   so texture coastlines and the code-native outlines align by construction.
2. **Layers panel** (header button): planet orbits, ecliptic rings, Moon
   orbit, sunlight direction, Earth axis & equator, sky grid, marker labels,
   below-horizon markers. Guides default on only where Phase 3–4 already
   showed them; axis and sky grid default off (SPEC §12: sparse by default).
   The old hidden coordinate grid was repurposed as the camera-anchored alt-az
   sky grid. In-app data/imagery credits live at the bottom of the panel.
3. **Marker label declutter:** brightest-first greedy pass each frame; a label
   within 34 px of an already-labeled marker hides while its ring stays
   selectable.
4. **Compass mode** (SPEC §24): started only from an explicit button in the
   location panel, with iOS `requestPermission` handling; headings ease the
   ground-scale view via the store. Degrades to a status message when
   unsupported or declined. The alpha/webkitCompassHeading mapping is
   unit-tested.
5. **Adaptive quality:** sustained >26 ms average frames step the pixel ratio
   down 0.25 (floor 1, one step per 5 s). Astronomical accuracy is never
   reduced, per the spec's adaptation ordering.

Deferred, recorded here: cloud layer and Stage-B scattering atmosphere
(current dual-shell atmosphere stays); libration-accurate Moon inset; a
WebGPU-native device pass (still no adapter in the verification environment).

## Verification

- `src/tests/compass-mode.test.ts` — heading mapping.
- `tests/e2e/phase-five.spec.ts` — non-blocking texture load (GPU texture
  count), layers defaults and toggles, credits text, label declutter at system
  scale, reduced-motion setting.
- Live: textured whole Earth shows Blue Marble day side, Black Marble city
  lights on the night side, and outline/texture coastline alignment at 60 fps.
