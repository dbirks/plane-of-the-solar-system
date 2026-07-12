/**
 * Offline observer-location provider chain (SPEC §23, reduced per ADR-0006):
 * explicit URL parameters → saved local preference → IANA timezone centroid →
 * Indianapolis fallback. Never blocks the opening scene and never issues a
 * network request or permission prompt; precise browser geolocation is a
 * separate, user-initiated action in the location picker.
 */

export type ObserverSource = "url" | "saved" | "timezone" | "fallback";

export type ObserverLocation = {
  latitudeDeg: number;
  longitudeDeg: number;
  label: string;
  source: ObserverSource;
};

export const OBSERVER_STORAGE_KEY = "plane-observer-location-v1";

export const FALLBACK_OBSERVER: ObserverLocation = {
  latitudeDeg: 39.7684,
  longitudeDeg: -86.1581,
  label: "Indianapolis",
  source: "fallback",
};

/**
 * Centroids for common IANA zones. Coarse by design: the sky changes by about
 * one degree per degree of travel, and this only seeds the opening view.
 */
const TIMEZONE_CENTROIDS: Record<string, { latitudeDeg: number; longitudeDeg: number }> = {
  "America/New_York": { latitudeDeg: 40.71, longitudeDeg: -74.01 },
  "America/Detroit": { latitudeDeg: 42.33, longitudeDeg: -83.05 },
  "America/Chicago": { latitudeDeg: 41.88, longitudeDeg: -87.63 },
  "America/Denver": { latitudeDeg: 39.74, longitudeDeg: -104.99 },
  "America/Phoenix": { latitudeDeg: 33.45, longitudeDeg: -112.07 },
  "America/Los_Angeles": { latitudeDeg: 34.05, longitudeDeg: -118.24 },
  "America/Anchorage": { latitudeDeg: 61.22, longitudeDeg: -149.9 },
  "America/Toronto": { latitudeDeg: 43.65, longitudeDeg: -79.38 },
  "America/Vancouver": { latitudeDeg: 49.28, longitudeDeg: -123.12 },
  "America/Mexico_City": { latitudeDeg: 19.43, longitudeDeg: -99.13 },
  "America/Bogota": { latitudeDeg: 4.71, longitudeDeg: -74.07 },
  "America/Lima": { latitudeDeg: -12.05, longitudeDeg: -77.04 },
  "America/Sao_Paulo": { latitudeDeg: -23.55, longitudeDeg: -46.63 },
  "America/Argentina/Buenos_Aires": { latitudeDeg: -34.6, longitudeDeg: -58.38 },
  "America/Santiago": { latitudeDeg: -33.45, longitudeDeg: -70.67 },
  "Europe/London": { latitudeDeg: 51.51, longitudeDeg: -0.13 },
  "Europe/Dublin": { latitudeDeg: 53.35, longitudeDeg: -6.26 },
  "Europe/Paris": { latitudeDeg: 48.86, longitudeDeg: 2.35 },
  "Europe/Madrid": { latitudeDeg: 40.42, longitudeDeg: -3.7 },
  "Europe/Lisbon": { latitudeDeg: 38.72, longitudeDeg: -9.14 },
  "Europe/Berlin": { latitudeDeg: 52.52, longitudeDeg: 13.41 },
  "Europe/Rome": { latitudeDeg: 41.9, longitudeDeg: 12.5 },
  "Europe/Amsterdam": { latitudeDeg: 52.37, longitudeDeg: 4.9 },
  "Europe/Zurich": { latitudeDeg: 47.38, longitudeDeg: 8.54 },
  "Europe/Vienna": { latitudeDeg: 48.21, longitudeDeg: 16.37 },
  "Europe/Prague": { latitudeDeg: 50.08, longitudeDeg: 14.44 },
  "Europe/Warsaw": { latitudeDeg: 52.23, longitudeDeg: 21.01 },
  "Europe/Stockholm": { latitudeDeg: 59.33, longitudeDeg: 18.07 },
  "Europe/Oslo": { latitudeDeg: 59.91, longitudeDeg: 10.75 },
  "Europe/Helsinki": { latitudeDeg: 60.17, longitudeDeg: 24.94 },
  "Europe/Copenhagen": { latitudeDeg: 55.68, longitudeDeg: 12.57 },
  "Europe/Athens": { latitudeDeg: 37.98, longitudeDeg: 23.73 },
  "Europe/Istanbul": { latitudeDeg: 41.01, longitudeDeg: 28.98 },
  "Europe/Kyiv": { latitudeDeg: 50.45, longitudeDeg: 30.52 },
  "Europe/Moscow": { latitudeDeg: 55.76, longitudeDeg: 37.62 },
  "Africa/Cairo": { latitudeDeg: 30.04, longitudeDeg: 31.24 },
  "Africa/Lagos": { latitudeDeg: 6.52, longitudeDeg: 3.38 },
  "Africa/Nairobi": { latitudeDeg: -1.29, longitudeDeg: 36.82 },
  "Africa/Johannesburg": { latitudeDeg: -26.2, longitudeDeg: 28.05 },
  "Africa/Casablanca": { latitudeDeg: 33.57, longitudeDeg: -7.59 },
  "Asia/Jerusalem": { latitudeDeg: 31.77, longitudeDeg: 35.21 },
  "Asia/Dubai": { latitudeDeg: 25.2, longitudeDeg: 55.27 },
  "Asia/Karachi": { latitudeDeg: 24.86, longitudeDeg: 67.0 },
  "Asia/Kolkata": { latitudeDeg: 22.57, longitudeDeg: 88.36 },
  "Asia/Dhaka": { latitudeDeg: 23.81, longitudeDeg: 90.41 },
  "Asia/Bangkok": { latitudeDeg: 13.76, longitudeDeg: 100.5 },
  "Asia/Jakarta": { latitudeDeg: -6.21, longitudeDeg: 106.85 },
  "Asia/Singapore": { latitudeDeg: 1.35, longitudeDeg: 103.82 },
  "Asia/Hong_Kong": { latitudeDeg: 22.32, longitudeDeg: 114.17 },
  "Asia/Shanghai": { latitudeDeg: 31.23, longitudeDeg: 121.47 },
  "Asia/Taipei": { latitudeDeg: 25.03, longitudeDeg: 121.57 },
  "Asia/Seoul": { latitudeDeg: 37.57, longitudeDeg: 126.98 },
  "Asia/Tokyo": { latitudeDeg: 35.68, longitudeDeg: 139.69 },
  "Australia/Perth": { latitudeDeg: -31.95, longitudeDeg: 115.86 },
  "Australia/Adelaide": { latitudeDeg: -34.93, longitudeDeg: 138.6 },
  "Australia/Brisbane": { latitudeDeg: -27.47, longitudeDeg: 153.03 },
  "Australia/Sydney": { latitudeDeg: -33.87, longitudeDeg: 151.21 },
  "Australia/Melbourne": { latitudeDeg: -37.81, longitudeDeg: 144.96 },
  "Pacific/Auckland": { latitudeDeg: -36.85, longitudeDeg: 174.76 },
  "Pacific/Honolulu": { latitudeDeg: 21.31, longitudeDeg: -157.86 },
  "America/Indiana/Indianapolis": { latitudeDeg: 39.7684, longitudeDeg: -86.1581 },
};

function labelFromTimezone(timezone: string): string {
  const lastSegment = timezone.split("/").at(-1) ?? timezone;
  return lastSegment.replaceAll("_", " ");
}

function finiteOrNull(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadSavedObserver(storage: StorageLike): ObserverLocation | null {
  try {
    const raw = storage.getItem(OBSERVER_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as { latitudeDeg?: unknown; longitudeDeg?: unknown; label?: unknown };
    if (
      typeof candidate.latitudeDeg !== "number" ||
      !Number.isFinite(candidate.latitudeDeg) ||
      typeof candidate.longitudeDeg !== "number" ||
      !Number.isFinite(candidate.longitudeDeg)
    ) {
      return null;
    }
    return {
      latitudeDeg: candidate.latitudeDeg,
      longitudeDeg: candidate.longitudeDeg,
      label:
        typeof candidate.label === "string" && candidate.label ? candidate.label : "Saved location",
      source: "saved",
    };
  } catch {
    return null;
  }
}

export function saveObserver(
  storage: StorageLike,
  location: { latitudeDeg: number; longitudeDeg: number; label: string },
): void {
  storage.setItem(OBSERVER_STORAGE_KEY, JSON.stringify(location));
}

export function clearSavedObserver(storage: StorageLike): void {
  storage.removeItem(OBSERVER_STORAGE_KEY);
}

export function observerFromTimezone(timezone: string | undefined): ObserverLocation | null {
  if (!timezone) return null;
  const centroid = TIMEZONE_CENTROIDS[timezone];
  if (!centroid) return null;
  return {
    latitudeDeg: centroid.latitudeDeg,
    longitudeDeg: centroid.longitudeDeg,
    label: `Near ${labelFromTimezone(timezone)}`,
    source: "timezone",
  };
}

export function resolveObserverLocation(
  search: string,
  storage: StorageLike | null,
  timezone?: string,
): ObserverLocation {
  const params = new URLSearchParams(search);
  const latitudeDeg = finiteOrNull(params.get("lat"));
  const longitudeDeg = finiteOrNull(params.get("lon"));
  if (latitudeDeg !== null && longitudeDeg !== null) {
    return {
      latitudeDeg,
      longitudeDeg,
      label: `${latitudeDeg.toFixed(2)}, ${longitudeDeg.toFixed(2)}`,
      source: "url",
    };
  }

  if (storage) {
    const saved = loadSavedObserver(storage);
    if (saved) return saved;
  }

  const zoned = observerFromTimezone(timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  if (zoned) return zoned;

  return FALLBACK_OBSERVER;
}
