import type { Vec3d } from "./vec3d";
import { scaleVec3d, subtractVec3d } from "./vec3d";

export function toCameraRelativeRender(
  physicalPositionM: Vec3d,
  renderOriginM: Vec3d,
  renderUnitsPerMeter: number,
): Vec3d {
  return scaleVec3d(subtractVec3d(physicalPositionM, renderOriginM), renderUnitsPerMeter);
}
