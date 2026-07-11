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
  { sliderT: 0.16, composition: 0.01 },
  { sliderT: 0.38, composition: 0.17 },
  { sliderT: 0.58, composition: 0.34 },
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

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}
