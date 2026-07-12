export type RendererPreference = "auto" | "webgl";
export type DepthPreference = "reversed" | "log" | "standard";
export type QualityPreference = "auto" | "low" | "high";

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
};

function finiteQueryNumber(params: URLSearchParams, key: string, fallback: number) {
  const value = Number(params.get(key));
  return Number.isFinite(value) ? value : fallback;
}

export function readFeatureFlags(search = window.location.search): FeatureFlags {
  const params = new URLSearchParams(search);
  const renderer = params.get("renderer") === "webgl" ? "webgl" : "auto";
  const depthValue = params.get("depth");
  const depth = depthValue === "log" || depthValue === "standard" ? depthValue : "reversed";
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
  };
}
