# Coordinate frames

| Frame                   | Axes                                       | Units                      | Current use                       |
| ----------------------- | ------------------------------------------ | -------------------------- | --------------------------------- |
| `EQJ`                   | J2000 mean equator                         | meters at service boundary | Star catalog RA/dec; body probes  |
| `ECL_J2000`             | +X equinox, +Y prograde, +Z ecliptic north | meters                     | Reserved for solar-system phase   |
| `HOR`                   | +X north, +Y west, +Z up                   | unit direction or meters   | Topocentric alt-az for all bodies |
| `LOCAL_THREE`           | +X east, +Y up, +Z south                   | render units               | Ground camera and controls        |
| `EARTH_FIXED`           | +X lat 0/lon 0, +Z north pole              | meters                     | Observer location and marker      |
| `EARTH_CENTERED_RENDER` | Three Y-up, camera-relative                | adaptive render units      | Phase 1 Earth scene               |
| `HELIOCENTRIC_RENDER`   | ecliptic mapped to Three Y-up              | adaptive render units      | Reserved for solar-system phase   |

Mappings required by the spec:

- Ecliptic to Three: `[x, y, z] -> [x, z, -y]`
- Horizontal to local Three: `[north, west, up] -> [-west, up, -north]`
- Earth-fixed to Three Y-up: `[x, y, z] -> [x, z, -y]`

Physical state uses JavaScript double-precision numbers and meters. Three.js vectors are temporary rendering values only.

## Phase 2 sky chain

- Per-body path: astronomy-engine topocentric of-date RA/dec → `Horizon` (refracted alt-az) → `altAzToLocalThree` builds the HOR unit vector `[north, west, up]` and applies the documented HOR→local-Three mapping.
- Star-field path: `Rotation_EQJ_HOR(time, observer)` gives EQJ→HOR ([north, west, zenith] axes, matching the HOR frame exactly); `computeSkyState` composes it with HOR→local-Three into one row-major 3×3 (`eqjToLocalThree`) applied as the star group's rotation. astronomy-engine stores `rot[source][target]` — transposed from the usual convention — which the wrapper normalizes.
- The two paths are cross-validated to within 0.1° in `src/tests/astronomy.test.ts`, and both are checked against an independent truncated-Meeus reference (Sun 0.3°, Moon 0.5°).
- Azimuth convention everywhere: degrees from north toward east. Alt-az→local-Three: `az 0 → −Z (north)`, `az 90 → +X (east)`, `alt 90 → +Y (zenith)`.
