import type { Vec3d } from "../coordinates/vec3d";

export function wholeEarthFovDegForAspect(viewportAspect: number): number {
  if (viewportAspect >= 0.8) return 46;

  const desiredHorizontalFovDeg = 36;
  const horizontalHalfRadians = (desiredHorizontalFovDeg * Math.PI) / 360;
  const verticalFovRadians =
    2 * Math.atan(Math.tan(horizontalHalfRadians) / Math.max(0.35, viewportAspect));
  return Math.min(76, (verticalFovRadians * 180) / Math.PI);
}

// The gaze sweeps from the horizon at ground level to straight down at the
// observer's dot by the atmosphere landmark (sliderT 0.24) — the journey is
// "look at where you are standing" almost immediately, and every scale
// beyond simply pulls that view further away.
const COMPOSITION_ANCHORS = [
  { sliderT: 0, composition: 0 },
  { sliderT: 0.06, composition: 0.05 },
  { sliderT: 0.15, composition: 0.55 },
  { sliderT: 0.24, composition: 1 },
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
 * distance) shares the frame with the planet below.
 */
export function earthMoonCompositionForAltitude(
  altitudeM: number,
  moonRayLocal: Vec3d,
  baseFovDeg: number,
): FramingWiden {
  const logAltitude = Math.log10(Math.max(1, altitudeM));
  const blendT = Math.min(1, Math.max(0, (logAltitude - 7.5) / (8.5 - 7.5)));
  const blend = blendT * blendT * (3 - 2 * blendT);

  // Angle between the nadir gaze and the Moon's direction.
  const separationDeg =
    (Math.acos(Math.min(1, Math.max(-1, -moonRayLocal[1]))) * 180) / Math.PI;
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
 * How strongly screen-up re-levels from the observer's zenith to ecliptic
 * north on the outward journey (0 through the atmosphere, 1 by the whole
 * Earth landmark). This roll is the "I was standing on the side of a planet"
 * reveal: the world turns beneath you through low orbit, and whole Earth
 * arrives visibly tilted against a solar-system plane that is already flat.
 */
export function eclipticRollBlendForAltitude(altitudeM: number): number {
  const logAltitude = Math.log10(Math.max(1, altitudeM));
  const t = Math.min(1, Math.max(0, (logAltitude - 5) / (7.3 - 5)));
  return t * t * (3 - 2 * t);
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}
