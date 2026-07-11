export type RendererPreference = "auto" | "webgl";
export type DepthPreference = "reversed" | "log" | "standard";
export type QualityPreference = "auto" | "low" | "high";

export type FeatureFlags = {
  debug: boolean;
  renderer: RendererPreference;
  depth: DepthPreference;
  quality: QualityPreference;
  fixedTimeUtcMs: number;
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
  const parsedTime = Date.parse(params.get("time") ?? "2026-07-11T22:00:00Z");

  return {
    debug: params.get("debug") === "1",
    renderer,
    depth,
    quality,
    fixedTimeUtcMs: Number.isNaN(parsedTime) ? Date.parse("2026-07-11T22:00:00Z") : parsedTime,
    latitudeDeg: finiteQueryNumber(params, "lat", 39.7684),
    longitudeDeg: finiteQueryNumber(params, "lon", -86.1581),
  };
}
