export type RendererPreference = "auto" | "webgl";
export type DepthPreference = "reversed" | "log" | "standard";
export type QualityPreference = "auto" | "low" | "high";
export type DistanceUnit = "km" | "mi";

export type FeatureFlags = {
  debug: boolean;
  renderer: RendererPreference;
  depth: DepthPreference;
  quality: QualityPreference;
  /** Simulation start time: the ?time= parameter when given, otherwise now. */
  initialUtcMs: number;
  /** True when ?time= pinned the clock for reproducible captures. */
  hasExplicitTime: boolean;
  latitudeDeg: number;
  longitudeDeg: number;
  /** Miles for miles-country locales (or ?units=), kilometres otherwise. */
  distanceUnit: DistanceUnit;
};

/** Countries whose road distances are customarily miles. */
const MILE_REGIONS = new Set(["US", "GB", "LR", "MM"]);

export function resolveDistanceUnit(
  params: URLSearchParams,
  locales: readonly string[],
): DistanceUnit {
  const override = params.get("units");
  if (override === "mi") return "mi";
  if (override === "km") return "km";
  for (const tag of locales) {
    try {
      // maximize() infers a likely region for bare language tags ("en" → US).
      const region = new Intl.Locale(tag).maximize().region;
      if (region) return MILE_REGIONS.has(region) ? "mi" : "km";
    } catch {
      // Malformed tag — try the next locale.
    }
  }
  return "km";
}

function finiteQueryNumber(params: URLSearchParams, key: string, fallback: number) {
  const raw = params.get(key);
  // Number(null) and Number("") are 0, which would silently replace the
  // fallback with the null island observer — treat absent/blank as missing.
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function readFeatureFlags(
  search = window.location.search,
  locales: readonly string[] = typeof navigator === "undefined" ? [] : navigator.languages,
): FeatureFlags {
  const params = new URLSearchParams(search);
  const renderer = params.get("renderer") === "webgl" ? "webgl" : "auto";
  const depthValue = params.get("depth");
  // Standard is the default: it is the path every e2e scenario and live
  // acceptance has always run, and the reversed depth buffer on the WebGL
  // backend fails to draw the satellite-imagery quads (three.js issue —
  // ADR-0018). Reversed and log remain reachable by flag; the per-frame
  // near/far scaling keeps precision across the whole journey.
  const depth = depthValue === "log" || depthValue === "reversed" ? depthValue : "standard";
  const qualityValue = params.get("quality");
  const quality = qualityValue === "low" || qualityValue === "high" ? qualityValue : "auto";
  const timeParam = params.get("time");
  const parsedTime = timeParam === null ? Number.NaN : Date.parse(timeParam);
  const hasExplicitTime = Number.isFinite(parsedTime);

  return {
    debug: params.get("debug") === "1",
    renderer,
    depth,
    quality,
    initialUtcMs: hasExplicitTime ? parsedTime : Date.now(),
    hasExplicitTime,
    latitudeDeg: finiteQueryNumber(params, "lat", 39.7684),
    longitudeDeg: finiteQueryNumber(params, "lon", -86.1581),
    distanceUnit: resolveDistanceUnit(params, locales),
  };
}
