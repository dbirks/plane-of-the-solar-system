import { METERS_PER_AU } from "../coordinates/units";

export function formatDistance(distanceM: number): string {
  if (distanceM < 1_000) return `Altitude · ${Math.round(distanceM)} m`;
  if (distanceM < 1_000_000) {
    const kilometers = distanceM / 1_000;
    return `Altitude · ${kilometers < 100 ? kilometers.toFixed(1) : Math.round(kilometers)} km`;
  }
  if (distanceM < 0.1 * METERS_PER_AU) {
    return `Distance from Earth · ${Math.round(distanceM / 1_000).toLocaleString("en-US")} km`;
  }
  return `Distance from Earth · ${(distanceM / METERS_PER_AU).toFixed(2)} AU`;
}
