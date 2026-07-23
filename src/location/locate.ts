/**
 * Coarse device location: never high-accuracy, and coordinates rounded to
 * two decimals (~1 km) before use — enough to orient the sky and imagery,
 * deliberately not enough to pin a house.
 */

import { useAppStore } from "../app/app-store";
import { nearestPlace } from "./nearest-place";
import { type ObserverSource, saveObserver } from "./observer-location";

/**
 * Re-aim the LIVE scene at a location — no page reload. The coordinates
 * still land in the URL (reproducible link, via replaceState) and in local
 * storage (next visit opens here), but the sky, globe, and imagery all
 * follow in place.
 */
export function applyObserverLocation(
  latitudeDeg: number,
  longitudeDeg: number,
  source: ObserverSource = "device",
): void {
  const label =
    nearestPlace(latitudeDeg, longitudeDeg)?.label ??
    `${latitudeDeg.toFixed(2)}, ${longitudeDeg.toFixed(2)}`;
  try {
    saveObserver(window.localStorage, { latitudeDeg, longitudeDeg, label });
  } catch {
    // Private browsing: the session still works, it just won't be remembered.
  }
  const params = new URLSearchParams(window.location.search);
  params.set("lat", latitudeDeg.toFixed(4));
  params.set("lon", longitudeDeg.toFixed(4));
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  useAppStore.getState().setObserver({ latitudeDeg, longitudeDeg, label, source });
}

export function roundCoarse(valueDeg: number): number {
  return Math.round(valueDeg * 100) / 100;
}

/**
 * Ask for a coarse position and re-aim there in place. Unavailable or
 * declined simply leaves the current sky standing.
 */
export function locateAndGo(): void {
  if (!("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      applyObserverLocation(
        roundCoarse(position.coords.latitude),
        roundCoarse(position.coords.longitude),
      );
    },
    () => {
      // Declined: keep the sky where it is rather than teleporting anywhere.
    },
    { enableHighAccuracy: false, timeout: 10_000 },
  );
}

/**
 * Startup only: when the browser has ALREADY granted geolocation to this
 * site (a previous explicit tap), reuse it silently so the first frame's sky
 * matches where the device actually is. Never prompts — a fresh visitor
 * still starts from the timezone guess until they tap the location button
 * (ADR-0006).
 */
export function adoptGrantedLocationSilently(): void {
  if (!("geolocation" in navigator) || !navigator.permissions?.query) return;
  navigator.permissions
    .query({ name: "geolocation" })
    .then((status) => {
      if (status.state === "granted") locateAndGo();
    })
    .catch(() => {});
}
