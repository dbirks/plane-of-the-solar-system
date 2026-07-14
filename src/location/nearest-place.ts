import {
  PLACE_COUNT,
  PLACE_ELEVATION_M,
  PLACE_LAT_DEG,
  PLACE_LON_DEG,
  PLACE_NAMES,
  PLACE_REGIONS,
} from "./place-catalog";

const DEG = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

/** Beyond this the nearest big city stops being a meaningful anchor. */
const MAX_ANCHOR_DISTANCE_KM = 400;

let names: string[] | null = null;
let regions: string[] | null = null;

export type NearestPlace = {
  /** e.g. "Indianapolis, IN" or "Berlin, Germany". */
  label: string;
  distanceKm: number;
  /** Ground elevation above sea level at the anchor city, meters. */
  elevationM: number;
};

function regionLabel(region: string): string {
  if (region.startsWith("US-")) return region.slice(3);
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(region) ?? region;
  } catch {
    return region;
  }
}

/**
 * Nearest big city to the observer from the bundled GeoNames subset —
 * a coarse, offline, privacy-friendly anchor ("near Indianapolis, IN")
 * instead of raw coordinates. Null in remote places and open ocean.
 */
export function nearestPlace(latitudeDeg: number, longitudeDeg: number): NearestPlace | null {
  names ??= PLACE_NAMES.split("|");
  regions ??= PLACE_REGIONS.split("|");

  const cosObserver = Math.cos(latitudeDeg * DEG);
  let bestIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i < PLACE_COUNT; i += 1) {
    // Equirectangular metric — plenty at city scale and 6× faster than
    // haversine over the whole catalog; ties resolve to the larger city
    // because the catalog is sorted by population.
    const dLat = PLACE_LAT_DEG[i]! - latitudeDeg;
    let dLon = Math.abs(PLACE_LON_DEG[i]! - longitudeDeg) % 360;
    if (dLon > 180) dLon = 360 - dLon;
    const score = dLat * dLat + dLon * cosObserver * (dLon * cosObserver);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  if (bestIndex < 0) return null;
  const distanceKm = Math.sqrt(bestScore) * DEG * EARTH_RADIUS_KM;
  if (distanceKm > MAX_ANCHOR_DISTANCE_KM) return null;
  return {
    label: `${names[bestIndex]!}, ${regionLabel(regions[bestIndex]!)}`,
    distanceKm,
    elevationM: PLACE_ELEVATION_M[bestIndex] ?? 0,
  };
}
