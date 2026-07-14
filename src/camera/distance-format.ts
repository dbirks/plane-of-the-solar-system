import type { DistanceUnit } from "../app/feature-flags";
import { METERS_PER_AU } from "../coordinates/units";

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

let activeUnit: DistanceUnit = "km";
let groundElevationM = 0;

/** Set once at startup from the resolved feature flags. */
export function setActiveDistanceUnit(unit: DistanceUnit): void {
  activeUnit = unit;
}

/**
 * Ground elevation above sea level at the observer (from the nearest-place
 * catalog). Altitude readouts add it so "how high am I" reads true — 2 m
 * above Indianapolis is ~220 m above the sea, not 7 ft.
 */
export function setGroundElevationM(elevationM: number): void {
  groundElevationM = elevationM;
}

/** "382,412 km" or "237,620 mi" — for inset readouts that add their own context. */
export function formatBodyRange(distanceM: number, unit: DistanceUnit = activeUnit): string {
  if (unit === "mi") return `${Math.round(distanceM / METERS_PER_MILE).toLocaleString("en-US")} mi`;
  return `${Math.round(distanceM / 1_000).toLocaleString("en-US")} km`;
}

export function formatDistance(distanceM: number, unit: DistanceUnit = activeUnit): string {
  // In the altitude regime, report height above sea level; beyond it the
  // ground elevation is far below the display precision.
  const altitudeM = distanceM + groundElevationM;
  if (unit === "mi") {
    if (altitudeM < METERS_PER_MILE) {
      return `Altitude · ${Math.round(altitudeM / METERS_PER_FOOT).toLocaleString("en-US")} ft`;
    }
    if (distanceM < 1_000_000) {
      const miles = altitudeM / METERS_PER_MILE;
      return `Altitude · ${miles < 100 ? miles.toFixed(1) : Math.round(miles)} mi`;
    }
    if (distanceM < 0.1 * METERS_PER_AU) {
      return `Distance from Earth · ${Math.round(distanceM / METERS_PER_MILE).toLocaleString("en-US")} mi`;
    }
    return `Distance from Earth · ${(distanceM / METERS_PER_AU).toFixed(2)} AU`;
  }

  if (altitudeM < 1_000) return `Altitude · ${Math.round(altitudeM)} m`;
  if (distanceM < 1_000_000) {
    const kilometers = altitudeM / 1_000;
    return `Altitude · ${kilometers < 100 ? kilometers.toFixed(1) : Math.round(kilometers)} km`;
  }
  if (distanceM < 0.1 * METERS_PER_AU) {
    return `Distance from Earth · ${Math.round(distanceM / 1_000).toLocaleString("en-US")} km`;
  }
  return `Distance from Earth · ${(distanceM / METERS_PER_AU).toFixed(2)} AU`;
}
