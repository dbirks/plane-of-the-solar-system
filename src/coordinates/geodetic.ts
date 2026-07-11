import { degreesToRadians } from "./units";
import type { Vec3d } from "./vec3d";

export function geodeticSurfaceUnitEarthFixed(latitudeDeg: number, longitudeDeg: number): Vec3d {
  const latitudeRad = degreesToRadians(latitudeDeg);
  const longitudeRad = degreesToRadians(longitudeDeg);
  const cosLatitude = Math.cos(latitudeRad);

  return [
    cosLatitude * Math.cos(longitudeRad),
    cosLatitude * Math.sin(longitudeRad),
    Math.sin(latitudeRad),
  ];
}
