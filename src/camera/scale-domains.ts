import { EARTH_MEAN_RADIUS_M, METERS_PER_AU } from "../coordinates/units";

export type ScaleDomain = "local" | "earth-centered" | "heliocentric";

export type ScaleLandmark = {
  id: "ground" | "atmosphere" | "low-orbit" | "whole-earth";
  label: string;
  distanceM: number;
  sliderT: number;
};

export const PHASE_ONE_MIN_DISTANCE_M = 2;
export const PHASE_ONE_MAX_DISTANCE_M = 20_000_000;

export const PHASE_ONE_LANDMARKS: readonly ScaleLandmark[] = [
  { id: "ground", label: "Ground", distanceM: 2, sliderT: 0 },
  { id: "atmosphere", label: "Atmosphere", distanceM: 100_000, sliderT: 0.38 },
  { id: "low-orbit", label: "Low orbit", distanceM: 500_000, sliderT: 0.58 },
  { id: "whole-earth", label: "Whole Earth", distanceM: 20_000_000, sliderT: 1 },
];

const JOURNEY_SCALE_ANCHORS = [
  { sliderT: 0, distanceM: PHASE_ONE_MIN_DISTANCE_M },
  { sliderT: 0.16, distanceM: 1_000 },
  { sliderT: 0.38, distanceM: 100_000 },
  { sliderT: 0.58, distanceM: 500_000 },
  { sliderT: 1, distanceM: PHASE_ONE_MAX_DISTANCE_M },
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
  const distance = Math.min(
    PHASE_ONE_MAX_DISTANCE_M,
    Math.max(PHASE_ONE_MIN_DISTANCE_M, distanceM),
  );
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

  for (const landmark of PHASE_ONE_LANDMARKS) {
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

export function scaleDomainForDistance(distanceM: number): ScaleDomain {
  if (distanceM < 2_000_000) return "local";
  if (distanceM < 100 * METERS_PER_AU) return "earth-centered";
  return "heliocentric";
}

export function earthRenderRadiusForAltitude(altitudeM: number): number {
  const t = Math.min(1, Math.max(0, Math.log10(Math.max(altitudeM, 10) / 10) / 6.3));
  return 1000 * (1 - t) + 2.15 * t;
}

export function renderUnitsPerMeterForAltitude(altitudeM: number): number {
  return earthRenderRadiusForAltitude(altitudeM) / EARTH_MEAN_RADIUS_M;
}
