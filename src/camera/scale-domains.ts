import { EARTH_MEAN_RADIUS_M } from "../coordinates/units";

export type ScaleDomain = "local" | "earth-centered" | "heliocentric";

export type ScaleLandmark = {
  id: "ground" | "whole-earth" | "earth-moon" | "inner-system" | "full-system";
  label: string;
  distanceM: number;
  sliderT: number;
};

export const JOURNEY_MIN_DISTANCE_M = 2;
// ~80 AU: far enough that Pluto's whole orbit (aphelion 49 AU) sits inside
// the final frame with margin.
export const JOURNEY_MAX_DISTANCE_M = 12_000_000_000_000;

// Ground goes straight to whole Earth — the atmosphere and low-orbit stops
// carried nothing actionable, so they are gone from the rail entirely and
// the journey beyond the ball owns the slider.
export const JOURNEY_LANDMARKS: readonly ScaleLandmark[] = [
  { id: "ground", label: "Ground", distanceM: 2, sliderT: 0 },
  { id: "whole-earth", label: "Whole Earth", distanceM: 20_000_000, sliderT: 0.22 },
  { id: "earth-moon", label: "Earth–Moon", distanceM: 500_000_000, sliderT: 0.42 },
  { id: "inner-system", label: "Inner system", distanceM: 400_000_000_000, sliderT: 0.72 },
  { id: "full-system", label: "Solar system", distanceM: JOURNEY_MAX_DISTANCE_M, sliderT: 1 },
];

const JOURNEY_SCALE_ANCHORS = [
  { sliderT: 0, distanceM: JOURNEY_MIN_DISTANCE_M },
  { sliderT: 0.22, distanceM: 20_000_000 },
  { sliderT: 0.42, distanceM: 500_000_000 },
  { sliderT: 0.72, distanceM: 400_000_000_000 },
  { sliderT: 1, distanceM: JOURNEY_MAX_DISTANCE_M },
] as const;

export function sliderToDistance(normalizedValue: number): number {
  const t = Math.min(1, Math.max(0, normalizedValue));
  const upperIndex = JOURNEY_SCALE_ANCHORS.findIndex((anchor) => anchor.sliderT >= t);
  if (upperIndex <= 0) return JOURNEY_SCALE_ANCHORS[0].distanceM;

  const lower = JOURNEY_SCALE_ANCHORS[upperIndex - 1]!;
  const upper = JOURNEY_SCALE_ANCHORS[upperIndex]!;
  const segmentT = (t - lower.sliderT) / (upper.sliderT - lower.sliderT);
  return Math.exp(
    Math.log(lower.distanceM) + segmentT * (Math.log(upper.distanceM) - Math.log(lower.distanceM)),
  );
}

export function distanceToSlider(distanceM: number): number {
  const distance = Math.min(JOURNEY_MAX_DISTANCE_M, Math.max(JOURNEY_MIN_DISTANCE_M, distanceM));
  const upperIndex = JOURNEY_SCALE_ANCHORS.findIndex((anchor) => anchor.distanceM >= distance);
  if (upperIndex <= 0) return JOURNEY_SCALE_ANCHORS[0].sliderT;

  const lower = JOURNEY_SCALE_ANCHORS[upperIndex - 1]!;
  const upper = JOURNEY_SCALE_ANCHORS[upperIndex]!;
  const segmentT =
    (Math.log(distance) - Math.log(lower.distanceM)) /
    (Math.log(upper.distanceM) - Math.log(lower.distanceM));
  return lower.sliderT + segmentT * (upper.sliderT - lower.sliderT);
}

export function applySoftLandmarkAttraction(normalizedValue: number): number {
  const radius = 0.018;
  let attracted = normalizedValue;

  for (const landmark of JOURNEY_LANDMARKS) {
    const landmarkT = landmark.sliderT;
    const delta = landmarkT - attracted;
    const absoluteDelta = Math.abs(delta);
    if (absoluteDelta < radius) {
      const influence = (1 - absoluteDelta / radius) ** 2 * 0.26;
      attracted += delta * influence;
    }
  }

  return Math.min(1, Math.max(0, attracted));
}

/** The landmark nearest to a distance in log space (for titles and readouts). */
export function nearestLandmark(distanceM: number): ScaleLandmark {
  const safeDistance = Math.max(1, distanceM);
  return JOURNEY_LANDMARKS.reduce((closest, candidate) =>
    Math.abs(Math.log(candidate.distanceM) - Math.log(safeDistance)) <
    Math.abs(Math.log(closest.distanceM) - Math.log(safeDistance))
      ? candidate
      : closest,
  );
}

export function scaleDomainForDistance(distanceM: number): ScaleDomain {
  if (distanceM < 2_000_000) return "local";
  if (distanceM < 10_000_000_000) return "earth-centered";
  return "heliocentric";
}

/**
 * Two-stage adaptive scale. Stage one (10 m → 20,000 km) shrinks Earth from
 * 1000 to 2.15 render units for the whole-Earth view. Stage two (beyond) keeps
 * shrinking log-linearly so the full solar system (camera 8×10¹² m out) fits
 * inside the far plane while proportions stay uniform and true.
 */
const STAGE_TWO_START_ALTITUDE_M = 20_000_000;
const STAGE_TWO_START_RADIUS = 2.15;
const STAGE_TWO_END_RADIUS = 0.004;

export function earthRenderRadiusForAltitude(altitudeM: number): number {
  const t = Math.min(1, Math.max(0, Math.log10(Math.max(altitudeM, 10) / 10) / 6.3));
  const stageOneRadius = 1000 * (1 - t) + STAGE_TWO_START_RADIUS * t;
  if (altitudeM <= STAGE_TWO_START_ALTITUDE_M) return stageOneRadius;
  const t2 = Math.min(
    1,
    Math.log10(altitudeM / STAGE_TWO_START_ALTITUDE_M) /
      Math.log10(JOURNEY_MAX_DISTANCE_M / STAGE_TWO_START_ALTITUDE_M),
  );
  return STAGE_TWO_START_RADIUS * (STAGE_TWO_END_RADIUS / STAGE_TWO_START_RADIUS) ** t2;
}

export function renderUnitsPerMeterForAltitude(altitudeM: number): number {
  return earthRenderRadiusForAltitude(altitudeM) / EARTH_MEAN_RADIUS_M;
}

/**
 * Camera near plane in render units. The standard depth buffer (the app
 * default — reversed depth never rasterizes the imagery quads, ADR-0018)
 * quantizes on far/near, so a fixed tiny near breaks down as the camera
 * climbs: at whole Earth the depth step exceeded the globe itself and every
 * surface z-fought every other. Nothing renderable sits closer than a good
 * fraction of the altitude (the nearest content IS the ground/globe at
 * altitude away; worst case is the Moon at the Earth–Moon leg, still beyond
 * 0.15×), so the near plane rides the altitude — capped under the camera-
 * anchored sky shell (bodies at 1300, stars at 1500).
 */
export function nearPlaneRenderUnitsForAltitude(altitudeM: number): number {
  return Math.min(
    900,
    Math.max(0.00001, altitudeM * renderUnitsPerMeterForAltitude(altitudeM) * 0.15),
  );
}
