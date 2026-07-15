import * as THREE from "three/webgpu";

import { geodeticSurfaceUnitEarthFixed } from "../../coordinates/geodetic";
import { earthFixedToThree } from "../../coordinates/transforms";
import { observerToZenithQuaternion } from "./continent-outlines";

/**
 * Rotation axis and equator guides in the shared earth-fixed orientation
 * (unit-Earth geometry; the renderer positions and scales them with the
 * globe). Off by default — enabled from the Layers panel.
 */
export function createEarthGuides(
  observerLatitudeDeg: number,
  observerLongitudeDeg: number,
): THREE.LineSegments {
  const points: number[] = [];

  // Axis through the poles, extended beyond the surface.
  const [poleX, poleY, poleZ] = earthFixedToThree([0, 0, 1]);
  points.push(
    poleX * 1.35,
    poleY * 1.35,
    poleZ * 1.35,
    -poleX * 1.35,
    -poleY * 1.35,
    -poleZ * 1.35,
  );

  // Equator ring just above the surface.
  const segments = 128;
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * 360;
    const b = ((i + 1) / segments) * 360;
    const [ax, ay, az] = earthFixedToThree(geodeticSurfaceUnitEarthFixed(0, a));
    const [bx, by, bz] = earthFixedToThree(geodeticSurfaceUnitEarthFixed(0, b));
    points.push(ax * 1.003, ay * 1.003, az * 1.003, bx * 1.003, by * 1.003, bz * 1.003);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xd9b96e,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const guides = new THREE.LineSegments(geometry, material);
  guides.quaternion.copy(observerToZenithQuaternion(observerLatitudeDeg, observerLongitudeDeg));
  guides.visible = false;
  return guides;
}

/**
 * Small default-on axis stubs just above and below the poles — enough to
 * read the planet's tilt against the flat ecliptic at the whole-Earth
 * reveal, without the full axis-and-equator guide.
 */
export function createAxisStubs(
  observerLatitudeDeg: number,
  observerLongitudeDeg: number,
): THREE.LineSegments {
  const [poleX, poleY, poleZ] = earthFixedToThree([0, 0, 1]);
  const points = [
    poleX * 1.05,
    poleY * 1.05,
    poleZ * 1.05,
    poleX * 1.32,
    poleY * 1.32,
    poleZ * 1.32,
    -poleX * 1.05,
    -poleY * 1.05,
    -poleZ * 1.05,
    -poleX * 1.32,
    -poleY * 1.32,
    -poleZ * 1.32,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xbcd4e6,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const stubs = new THREE.LineSegments(geometry, material);
  stubs.quaternion.copy(observerToZenithQuaternion(observerLatitudeDeg, observerLongitudeDeg));
  stubs.visible = false;
  return stubs;
}
