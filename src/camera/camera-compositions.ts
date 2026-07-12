import type { Vec3d } from "../coordinates/vec3d";

export function wholeEarthFovDegForAspect(viewportAspect: number): number {
  if (viewportAspect >= 0.8) return 46;

  const desiredHorizontalFovDeg = 36;
  const horizontalHalfRadians = (desiredHorizontalFovDeg * Math.PI) / 360;
  const verticalFovRadians =
    2 * Math.atan(Math.tan(horizontalHalfRadians) / Math.max(0.35, viewportAspect));
  return Math.min(76, (verticalFovRadians * 180) / Math.PI);
}

const COMPOSITION_ANCHORS = [
  { sliderT: 0, composition: 0 },
  { sliderT: 0.1, composition: 0.01 },
  { sliderT: 0.24, composition: 0.17 },
  { sliderT: 0.36, composition: 0.34 },
  { sliderT: 0.6, composition: 1 },
  { sliderT: 1, composition: 1 },
] as const;

export function journeyCompositionForSlider(normalizedValue: number): number {
  const sliderT = Math.min(1, Math.max(0, normalizedValue));
  const upperIndex = COMPOSITION_ANCHORS.findIndex((anchor) => anchor.sliderT >= sliderT);
  if (upperIndex <= 0) return COMPOSITION_ANCHORS[0].composition;

  const lower = COMPOSITION_ANCHORS[upperIndex - 1]!;
  const upper = COMPOSITION_ANCHORS[upperIndex]!;
  const segmentT = (sliderT - lower.sliderT) / (upper.sliderT - lower.sliderT);
  const smoothSegmentT = segmentT * segmentT * (3 - 2 * segmentT);
  return lerp(lower.composition, upper.composition, smoothSegmentT);
}

export type EarthMoonComposition = {
  /** 0 = pure whole-Earth nadir view, 1 = full Earth–Moon framing. */
  blend: number;
  /** Guided yaw in radians (rotation about +Y; 0 faces north). */
  guidedYawRad: number;
  /** Guided pitch in radians (0 = horizon, −π/2 = straight down). */
  guidedPitchRad: number;
  /** Vertical FOV that keeps both bodies in frame, degrees. */
  fovDeg: number;
};

/**
 * Frame Earth (straight below the camera) together with the Moon along
 * `moonRayLocal`. The gaze aims between them and the FOV widens to cover the
 * separation; the blend ramps in on the journey beyond whole Earth.
 */
export function earthMoonCompositionForAltitude(
  altitudeM: number,
  moonRayLocal: Vec3d,
  baseFovDeg: number,
): EarthMoonComposition {
  const logAltitude = Math.log10(Math.max(1, altitudeM));
  const blendT = Math.min(1, Math.max(0, (logAltitude - 7.5) / (8.5 - 7.5)));
  const blend = blendT * blendT * (3 - 2 * blendT);

  const [moonX, moonY, moonZ] = moonRayLocal;
  // Bias toward Earth so the planet stays anchored when the Moon is far away
  // in angle; the FOV covers the rest.
  const midX = moonX * 0.42;
  const midY = -1 + (moonY + 1) * 0.42;
  const midZ = moonZ * 0.42;
  const midLength = Math.hypot(midX, midY, midZ) || 1;

  const guidedPitchRad = Math.asin(Math.min(1, Math.max(-1, midY / midLength)));
  const horizontalLength = Math.hypot(midX, midZ);
  const guidedYawRad = horizontalLength < 1e-9 ? 0 : -Math.atan2(midX, -midZ);

  const separationRad = Math.acos(Math.min(1, Math.max(-1, -moonY)));
  const fovDeg = Math.min(92, Math.max(baseFovDeg, ((separationRad * 180) / Math.PI) * 0.62 + 30));

  return { blend, guidedYawRad, guidedPitchRad, fovDeg };
}

/**
 * Beyond the Earth–Moon band the gaze settles on the Sun (the system center;
 * from 8×10¹² m out, Earth sits within ~1° of it) and the FOV opens to hold
 * the whole ecliptic disc out to Pluto's orbit.
 */
export function systemCompositionForAltitude(
  altitudeM: number,
  sunRayLocal: Vec3d,
  baseFovDeg: number,
): EarthMoonComposition {
  const logAltitude = Math.log10(Math.max(1, altitudeM));
  const blendT = Math.min(1, Math.max(0, (logAltitude - 9.3) / (11.3 - 9.3)));
  const blend = blendT * blendT * (3 - 2 * blendT);

  const [sunX, sunY, sunZ] = sunRayLocal;
  const guidedPitchRad = Math.asin(Math.min(1, Math.max(-1, sunY)));
  const horizontalLength = Math.hypot(sunX, sunZ);
  const guidedYawRad = horizontalLength < 1e-9 ? 0 : -Math.atan2(sunX, -sunZ);
  const fovDeg = Math.max(baseFovDeg, 78);

  return { blend, guidedYawRad, guidedPitchRad, fovDeg };
}

/**
 * How strongly screen-up re-levels from the observer's zenith to ecliptic
 * north on the outward journey (0 at Earth–Moon scale and below, 1 by the
 * inner system). This roll is the "I was standing on the side of a planet"
 * reveal: the solar system's plane settles flat while your ground tilts away.
 */
export function eclipticRollBlendForAltitude(altitudeM: number): number {
  const logAltitude = Math.log10(Math.max(1, altitudeM));
  const t = Math.min(1, Math.max(0, (logAltitude - 8.9) / (11.2 - 8.9)));
  return t * t * (3 - 2 * t);
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}
