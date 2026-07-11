import { EARTH_MEAN_RADIUS_M, METERS_PER_AU } from "../coordinates/units";

export type ScaleDomain = "local" | "earth-centered" | "heliocentric";

export type ScaleLandmark = {
  id: "ground" | "atmosphere" | "low-orbit" | "whole-earth";
  label: string;
  distanceM: number;
};

export const PHASE_ONE_MIN_DISTANCE_M = 2;
export const PHASE_ONE_MAX_DISTANCE_M = 20_000_000;

export const PHASE_ONE_LANDMARKS: readonly ScaleLandmark[] = [
  { id: "ground", label: "Ground", distanceM: 2 },
  { id: "atmosphere", label: "Atmosphere", distanceM: 100_000 },
  { id: "low-orbit", label: "Low orbit", distanceM: 500_000 },
  { id: "whole-earth", label: "Whole Earth", distanceM: 20_000_000 },
];

export function sliderToDistance(
  normalizedValue: number,
  minM = PHASE_ONE_MIN_DISTANCE_M,
  maxM = PHASE_ONE_MAX_DISTANCE_M,
): number {
  const t = Math.min(1, Math.max(0, normalizedValue));
  return Math.exp(Math.log(minM) + t * (Math.log(maxM) - Math.log(minM)));
}

export function distanceToSlider(
  distanceM: number,
  minM = PHASE_ONE_MIN_DISTANCE_M,
  maxM = PHASE_ONE_MAX_DISTANCE_M,
): number {
  const distance = Math.min(maxM, Math.max(minM, distanceM));
  return (Math.log(distance) - Math.log(minM)) / (Math.log(maxM) - Math.log(minM));
}

export function applySoftLandmarkAttraction(normalizedValue: number): number {
  const radius = 0.018;
  let attracted = normalizedValue;

  for (const landmark of PHASE_ONE_LANDMARKS) {
    const landmarkT = distanceToSlider(landmark.distanceM);
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
