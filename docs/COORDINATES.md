# Coordinate frames

| Frame                   | Axes                                       | Units                      | Current use                     |
| ----------------------- | ------------------------------------------ | -------------------------- | ------------------------------- |
| `EQJ`                   | J2000 mean equator                         | meters at service boundary | Reserved for astronomy phase    |
| `ECL_J2000`             | +X equinox, +Y prograde, +Z ecliptic north | meters                     | Reserved for astronomy phase    |
| `HOR`                   | +X north, +Y west, +Z up                   | unit direction or meters   | Pure transform tests            |
| `LOCAL_THREE`           | +X east, +Y up, +Z south                   | render units               | Ground camera and controls      |
| `EARTH_FIXED`           | +X lat 0/lon 0, +Z north pole              | meters                     | Observer location and marker    |
| `EARTH_CENTERED_RENDER` | Three Y-up, camera-relative                | adaptive render units      | Phase 1 Earth scene             |
| `HELIOCENTRIC_RENDER`   | ecliptic mapped to Three Y-up              | adaptive render units      | Reserved for solar-system phase |

Mappings required by the spec:

- Ecliptic to Three: `[x, y, z] -> [x, z, -y]`
- Horizontal to local Three: `[north, west, up] -> [-west, up, -north]`
- Earth-fixed to Three Y-up: `[x, y, z] -> [x, z, -y]`

Physical state uses JavaScript double-precision numbers and meters. Three.js vectors are temporary rendering values only.
