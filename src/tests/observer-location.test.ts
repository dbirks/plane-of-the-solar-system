import { describe, expect, it } from "vitest";

import {
  clearSavedObserver,
  FALLBACK_OBSERVER,
  loadSavedObserver,
  OBSERVER_STORAGE_KEY,
  observerFromTimezone,
  resolveObserverLocation,
  saveObserver,
} from "../location/observer-location";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe("observer location provider chain (units: degrees, WGS84)", () => {
  it("prefers explicit URL parameters over everything else", () => {
    const storage = memoryStorage({
      [OBSERVER_STORAGE_KEY]: JSON.stringify({ latitudeDeg: 1, longitudeDeg: 2, label: "Saved" }),
    });
    const resolved = resolveObserverLocation("?lat=-33.87&lon=151.21", storage, "Europe/Paris");
    expect(resolved).toMatchObject({ latitudeDeg: -33.87, longitudeDeg: 151.21, source: "url" });
  });

  it("uses the saved location when no URL parameters are given", () => {
    const storage = memoryStorage({
      [OBSERVER_STORAGE_KEY]: JSON.stringify({
        latitudeDeg: 48.86,
        longitudeDeg: 2.35,
        label: "Paris",
      }),
    });
    const resolved = resolveObserverLocation("", storage, "Asia/Tokyo");
    expect(resolved).toMatchObject({
      latitudeDeg: 48.86,
      longitudeDeg: 2.35,
      label: "Paris",
      source: "saved",
    });
  });

  it("falls back to a timezone centroid, then Indianapolis", () => {
    const resolved = resolveObserverLocation("", memoryStorage(), "Asia/Tokyo");
    expect(resolved.source).toBe("timezone");
    expect(resolved.latitudeDeg).toBeCloseTo(35.68, 1);
    expect(resolved.label).toBe("Near Tokyo");

    const unknownZone = resolveObserverLocation("", memoryStorage(), "Mars/Olympus_Mons");
    expect(unknownZone).toEqual(FALLBACK_OBSERVER);
  });

  it("ignores malformed URL and storage values", () => {
    const storage = memoryStorage({ [OBSERVER_STORAGE_KEY]: "not-json{{" });
    const resolved = resolveObserverLocation("?lat=abc&lon=", storage, "Mars/Nowhere");
    expect(resolved).toEqual(FALLBACK_OBSERVER);
    expect(loadSavedObserver(storage)).toBeNull();
  });

  it("round-trips save, load, and clear", () => {
    const storage = memoryStorage();
    saveObserver(storage, { latitudeDeg: -12.05, longitudeDeg: -77.04, label: "Lima" });
    expect(loadSavedObserver(storage)).toMatchObject({
      latitudeDeg: -12.05,
      longitudeDeg: -77.04,
      label: "Lima",
      source: "saved",
    });
    clearSavedObserver(storage);
    expect(loadSavedObserver(storage)).toBeNull();
  });

  it("formats multi-segment timezone labels", () => {
    expect(observerFromTimezone("America/Indiana/Indianapolis")?.label).toBe("Near Indianapolis");
    expect(observerFromTimezone("America/Argentina/Buenos_Aires")?.label).toBe("Near Buenos Aires");
    expect(observerFromTimezone(undefined)).toBeNull();
  });
});
