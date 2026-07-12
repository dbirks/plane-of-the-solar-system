/**
 * Phase name from the Moon's ecliptic phase angle (degrees): 0 new,
 * 90 first quarter, 180 full, 270 third quarter. Principal phases own a
 * ±22.5° band, matching common almanac convention.
 */
export function moonPhaseName(phaseDeg: number): string {
  const normalized = ((phaseDeg % 360) + 360) % 360;
  if (normalized < 22.5 || normalized >= 337.5) return "New Moon";
  if (normalized < 67.5) return "Waxing crescent";
  if (normalized < 112.5) return "First quarter";
  if (normalized < 157.5) return "Waxing gibbous";
  if (normalized < 202.5) return "Full Moon";
  if (normalized < 247.5) return "Waning gibbous";
  if (normalized < 292.5) return "Third quarter";
  return "Waning crescent";
}
