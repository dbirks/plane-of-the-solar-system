import { GeoMoon, MakeTime } from "astronomy-engine";

import { METERS_PER_AU } from "../coordinates/units";

export const MOON_ORBIT_SAMPLE_COUNT = 168;
const SIDEREAL_MONTH_MS = 27.321661 * 86_400_000;

/**
 * Geocentric Moon positions in J2000 equatorial (EQJ) meters over one sidereal
 * month centered on `utcMs`, flattened [x0,y0,z0, x1,…]. The renderer keeps the
 * points in EQJ and orients the whole guide with the star-field rotation, so
 * Earth's spin never requires recomputation; refresh only when hours stale.
 */
export function computeMoonOrbitEqjM(
  utcMs: number,
  sampleCount = MOON_ORBIT_SAMPLE_COUNT,
): Float32Array {
  const points = new Float32Array(sampleCount * 3);
  for (let i = 0; i < sampleCount; i += 1) {
    const sampleMs = utcMs - SIDEREAL_MONTH_MS / 2 + (i / sampleCount) * SIDEREAL_MONTH_MS;
    const geoMoonEqjAu = GeoMoon(MakeTime(new Date(sampleMs)));
    points[i * 3] = geoMoonEqjAu.x * METERS_PER_AU;
    points[i * 3 + 1] = geoMoonEqjAu.y * METERS_PER_AU;
    points[i * 3 + 2] = geoMoonEqjAu.z * METERS_PER_AU;
  }
  return points;
}

/**
 * The Moon's current geocentric EQJ position in meters — the same source the
 * orbit guide samples, so a mesh placed with it sits exactly on the line.
 */
export function moonGeoEqjM(utcMs: number): readonly [number, number, number] {
  const geoMoonEqjAu = GeoMoon(MakeTime(new Date(utcMs)));
  return [
    geoMoonEqjAu.x * METERS_PER_AU,
    geoMoonEqjAu.y * METERS_PER_AU,
    geoMoonEqjAu.z * METERS_PER_AU,
  ];
}
