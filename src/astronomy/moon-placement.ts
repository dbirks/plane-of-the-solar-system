import { scaleVec3d, type Vec3d } from "../coordinates/vec3d";

export const MOON_MEAN_RADIUS_M = 1_738_100;

/**
 * Render distance of the sky-proxy shell (render units). While the true Moon
 * would land beyond the far plane, it is drawn at this distance along the same
 * ray with the same angular size, so the proxy→physical hand-off is exactly
 * continuous: same ray, same apparent size, only the render depth changes.
 */
export const MOON_PROXY_SHELL_RENDER_DISTANCE = 1300;

export type MoonPlacement = {
  /** Unit direction from the camera toward the Moon in the local Three frame. */
  rayLocal: Vec3d;
  /** Distance at which the mesh is drawn, render units. */
  renderDistance: number;
  /** Mesh radius, render units (true angular size at any distance). */
  renderRadius: number;
  /** True when the mesh sits at the true scaled distance (not the proxy shell). */
  physical: boolean;
  /** True camera-to-Moon distance in meters. */
  cameraDistanceM: number;
};

/**
 * Place the Moon for a camera `altitudeM` above the ground observer. The
 * camera rises along the observer's zenith (+Y in the local frame), so the
 * apparent Moon direction gains real parallax as altitude grows; the Earth–Moon
 * distance is never compressed once the placement is physical.
 */
export function computeMoonPlacement(
  moonDirectionLocalThree: Vec3d,
  moonTopocentricDistanceM: number,
  altitudeM: number,
  renderUnitsPerMeter: number,
): MoonPlacement {
  const moonFromGroundM = scaleVec3d(moonDirectionLocalThree, moonTopocentricDistanceM);
  const fromCameraM: Vec3d = [
    moonFromGroundM[0],
    moonFromGroundM[1] - altitudeM,
    moonFromGroundM[2],
  ];
  const cameraDistanceM = Math.hypot(fromCameraM[0], fromCameraM[1], fromCameraM[2]);
  const rayLocal = scaleVec3d(fromCameraM, 1 / cameraDistanceM);

  const physicalRenderDistance = cameraDistanceM * renderUnitsPerMeter;
  const physical = physicalRenderDistance <= MOON_PROXY_SHELL_RENDER_DISTANCE;
  const renderDistance = physical ? physicalRenderDistance : MOON_PROXY_SHELL_RENDER_DISTANCE;
  const angularRadiusRad = Math.asin(Math.min(1, MOON_MEAN_RADIUS_M / cameraDistanceM));
  const renderRadius = renderDistance * Math.tan(angularRadiusRad);

  return { rayLocal, renderDistance, renderRadius, physical, cameraDistanceM };
}

/** Alt-az (degrees, azimuth north→east) of a local-Three ray, for markers and look-at. */
export function rayToAltAzDeg(rayLocal: Vec3d): { altitudeDeg: number; azimuthDeg: number } {
  const altitudeDeg = (Math.asin(Math.min(1, Math.max(-1, rayLocal[1]))) * 180) / Math.PI;
  const azimuthDeg = ((Math.atan2(rayLocal[0], -rayLocal[2]) * 180) / Math.PI + 360) % 360;
  return { altitudeDeg, azimuthDeg };
}
