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
  { sliderT: 0.04, composition: 0.35 },
  { sliderT: 0.1, composition: 0.8 },
  { sliderT: 0.15, composition: 1 },
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
 * ever — and only the FOV widens toward the system framing's 78° so the
 * Moon's neighborhood shares the frame with the planet. Purely altitude-
 * driven: an earlier moon-separation feedback made the FOV (and with it the
 * whole frame, band included) creep and kink as the camera crossed the
 * Moon's distance — the frame must move only when the traveler moves.
 */
export function earthMoonCompositionForAltitude(altitudeM: number): FramingWiden {
  // A long, gentle band: the widening never outruns the zoom, so the
  // pull-out reads as one continuous recession with no stall and no
  // dolly-zoom "retilt".
  const logAltitude = Math.log10(Math.max(1, altitudeM));
  const blendT = Math.min(1, Math.max(0, (logAltitude - 7.4) / (8.7 - 7.4)));
  const blend = blendT * blendT * (3 - 2 * blendT);
  return { blend, fovDeg: 78 };
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
/**
 * The FIRST beat of the pull-out: as soon as the ground lets go (~15–60 m),
 * the gaze drops to a straight-down map view centered on where you stand,
 * screen-up to the north — the familiar aerial frame. The reveal then takes
 * that map and slowly banks it into the tilted ball; the gaze never returns
 * to the horizon, so there is no mid-journey spin.
 */
export function nadirBlendForAltitude(altitudeM: number): number {
  // Fully aerial by ~30 m (100 ft): the satellite imagery fades in right
  // after (25–60 m), so the map is always entered looking straight down.
  const logAltitude = Math.log10(Math.max(1, altitudeM));
  const t = Math.min(1, Math.max(0, (logAltitude - 1.0) / (1.48 - 1.0)));
  return t * t * (3 - 2 * t);
}

export function revealBlendForAltitude(altitudeM: number): number {
  // The realign is a LATE, slow beat: the map view stays glued straight
  // down over the observer's dot until ~1300 km out, then over more than a
  // decade of altitude (finishing right at whole Earth, 2e7 m) the vantage
  // banks around the planet, the plane settles dead level, and the tilt
  // shows. Smootherstep (zero velocity AND acceleration at both ends) so
  // the bank's onset is imperceptible rather than a sudden rotation.
  const logAltitude = Math.log10(Math.max(1, altitudeM));
  const t = Math.min(1, Math.max(0, (logAltitude - 6.1) / (7.3 - 6.1)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * How far around the planet the reveal vantage swings from the observer's
 * zenith (radians, about ecliptic north). ~35°: the observer's dot stays
 * front-ish on the tilted globe, facing the camera, clearly on a side —
 * trimmed from 45° because the bank's onset read as "tilting away really
 * quick", with the ground sliding off-screen; less total swing over the
 * same altitude band means a gentler apparent rotation.
 */
export const OBSERVER_SWING_RAD = (35 * Math.PI) / 180;

/** Camera vantage above the ecliptic during the reveal (unitless mix toward
 * ecliptic north; ~8.5° of ecliptic latitude — a near-side-on view so the
 * plane reads as a flat line, not a disc seen from above). */
export const REVEAL_NORTH_LIFT = 0.15;

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}
