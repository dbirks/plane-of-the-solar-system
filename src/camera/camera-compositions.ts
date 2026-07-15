import type { Vec3d } from "../coordinates/vec3d";

export function wholeEarthFovDegForAspect(viewportAspect: number): number {
  if (viewportAspect >= 0.8) return 46;

  const desiredHorizontalFovDeg = 36;
  const horizontalHalfRadians = (desiredHorizontalFovDeg * Math.PI) / 360;
  const verticalFovRadians =
    2 * Math.atan(Math.tan(horizontalHalfRadians) / Math.max(0.35, viewportAspect));
  return Math.min(76, (verticalFovRadians * 180) / Math.PI);
}

// Drives only the FOV settle now (58° near the ground to the whole-Earth
// framing): the gaze itself never detours to the nadir — it eases straight
// into the reveal frame (see revealBlendForAltitude).
const COMPOSITION_ANCHORS = [
  { sliderT: 0, composition: 0 },
  { sliderT: 0.03, composition: 0.05 },
  { sliderT: 0.08, composition: 0.55 },
  { sliderT: 0.12, composition: 1 },
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

export type FramingWiden = {
  /** 0 = base framing, 1 = fully widened for this band. */
  blend: number;
  /** Vertical FOV target for this band, degrees. */
  fovDeg: number;
};

/**
 * Beyond whole Earth the gaze stays pinned on Earth — no yaw or pitch swing,
 * ever — and only the FOV widens so the Moon (at `moonRayLocal`, true
 * distance) shares the frame with the planet. `gazeLocal` is the unit
 * direction the guided camera looks along (toward Earth's center).
 */
export function earthMoonCompositionForAltitude(
  altitudeM: number,
  moonRayLocal: Vec3d,
  gazeLocal: Vec3d,
  baseFovDeg: number,
): FramingWiden {
  const logAltitude = Math.log10(Math.max(1, altitudeM));
  const blendT = Math.min(1, Math.max(0, (logAltitude - 7.5) / (8.5 - 7.5)));
  const blend = blendT * blendT * (3 - 2 * blendT);

  // Angle between the Earth-pinned gaze and the Moon's direction.
  const separationCos =
    moonRayLocal[0] * gazeLocal[0] + moonRayLocal[1] * gazeLocal[1] + moonRayLocal[2] * gazeLocal[2];
  const separationDeg = (Math.acos(Math.min(1, Math.max(-1, separationCos))) * 180) / Math.PI;
  const fovDeg = Math.min(100, Math.max(baseFovDeg, separationDeg * 2.2 + 8));

  return { blend, fovDeg };
}

/**
 * Beyond the Earth–Moon band the FOV opens to hold the ecliptic disc out to
 * Pluto's orbit. The gaze never leaves Earth: at full-system distance the Sun
 * sits within ~1° of it, so the system assembles around the line of sight
 * with no spin at all.
 */
export function systemCompositionForAltitude(altitudeM: number, baseFovDeg: number): FramingWiden {
  const logAltitude = Math.log10(Math.max(1, altitudeM));
  const blendT = Math.min(1, Math.max(0, (logAltitude - 9.3) / (11.3 - 9.3)));
  const blend = blendT * blendT * (3 - 2 * blendT);
  return { blend, fovDeg: Math.max(baseFovDeg, 78) };
}

/**
 * The whole reveal is ONE motion, and this is its progress. From about 10 km
 * up, the camera frame eases from the ground's free-look frame straight into
 * the reveal frame: screen-up on ecliptic north (the plane of the solar
 * system reads flat almost immediately), the plane stretching across the
 * background, and Earth standing off to the RIGHT of center with the
 * observer's dot on its side. Fully settled well before whole Earth — from
 * there out, nothing re-aims; the frame only zooms.
 */
export function revealBlendForAltitude(altitudeM: number): number {
  const logAltitude = Math.log10(Math.max(1, altitudeM));
  const t = Math.min(1, Math.max(0, (logAltitude - 4) / (6.6 - 4)));
  return t * t * (3 - 2 * t);
}

/**
 * How far around the planet the reveal vantage swings from the observer's
 * zenith (radians, about ecliptic north). ~70°: the observer's dot rides
 * visibly on the SIDE of the tilted globe without slipping onto the limb.
 */
export const OBSERVER_SWING_RAD = (70 * Math.PI) / 180;

/** Camera vantage above the ecliptic during the reveal (unitless mix toward
 * ecliptic north; ~8.5° of ecliptic latitude — a near-side-on view so the
 * plane reads as a flat line, not a disc seen from above). */
export const REVEAL_NORTH_LIFT = 0.15;

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}
