import type { Vec3d } from "./vec3d";

export function eclipticToThree([x, y, z]: Vec3d): Vec3d {
  return [x, z, -y];
}

export function horizonToLocalThree([north, west, up]: Vec3d): Vec3d {
  return [-west, up, -north];
}

export function earthFixedToThree([x, y, z]: Vec3d): Vec3d {
  return [x, z, -y];
}
