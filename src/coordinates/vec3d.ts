export type Vec3d = readonly [number, number, number];

export function subtractVec3d(a: Vec3d, b: Vec3d): Vec3d {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scaleVec3d(vector: Vec3d, scalar: number): Vec3d {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}
