/**
 * Coarse device location: never high-accuracy, and coordinates rounded to
 * two decimals (~1 km) before use — enough to orient the sky and imagery,
 * deliberately not enough to pin a house.
 */

export const CENTER_OF_US = { latitudeDeg: 39.83, longitudeDeg: -98.58 };

/** Reload with explicit lat/lon so the location stays a reproducible URL state. */
export function navigateWithLocation(latitudeDeg: number, longitudeDeg: number): void {
  const params = new URLSearchParams(window.location.search);
  params.set("lat", latitudeDeg.toFixed(4));
  params.set("lon", longitudeDeg.toFixed(4));
  window.location.search = params.toString();
}

export function roundCoarse(valueDeg: number): number {
  return Math.round(valueDeg * 100) / 100;
}

/**
 * Ask for a coarse position and navigate there; falls back to the center of
 * the US when unavailable or declined.
 */
export function locateAndGo(): void {
  if (!("geolocation" in navigator)) {
    navigateWithLocation(CENTER_OF_US.latitudeDeg, CENTER_OF_US.longitudeDeg);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      navigateWithLocation(
        roundCoarse(position.coords.latitude),
        roundCoarse(position.coords.longitude),
      );
    },
    () => {
      navigateWithLocation(CENTER_OF_US.latitudeDeg, CENTER_OF_US.longitudeDeg);
    },
    { enableHighAccuracy: false, timeout: 10_000 },
  );
}
