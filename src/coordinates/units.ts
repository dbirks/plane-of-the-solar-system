export const EARTH_MEAN_RADIUS_M = 6_371_000;
export const METERS_PER_AU = 149_597_870_700;

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
