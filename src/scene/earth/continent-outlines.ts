import * as THREE from "three/webgpu";

import { geodeticSurfaceUnitEarthFixed } from "../../coordinates/geodetic";
import { earthFixedToThree } from "../../coordinates/transforms";

type LonLat = readonly [longitudeDeg: number, latitudeDeg: number];

const COASTLINES: readonly (readonly LonLat[])[] = [
  [
    [-168, 71],
    [-150, 70],
    [-135, 60],
    [-128, 52],
    [-124, 45],
    [-117, 32],
    [-106, 23],
    [-97, 18],
    [-88, 21],
    [-82, 25],
    [-80, 33],
    [-74, 40],
    [-66, 44],
    [-60, 50],
    [-66, 55],
    [-80, 58],
    [-92, 67],
    [-112, 72],
    [-140, 72],
    [-168, 71],
  ],
  [
    [-81, 12],
    [-70, 11],
    [-60, 8],
    [-50, 2],
    [-35, -6],
    [-39, -18],
    [-48, -28],
    [-55, -39],
    [-67, -55],
    [-73, -44],
    [-74, -30],
    [-80, -13],
    [-81, 12],
  ],
  [
    [-58, 83],
    [-28, 82],
    [-18, 72],
    [-30, 62],
    [-49, 59],
    [-61, 68],
    [-58, 83],
  ],
  [
    [-17, 37],
    [5, 36],
    [25, 32],
    [35, 24],
    [43, 12],
    [51, 2],
    [42, -13],
    [34, -26],
    [18, -35],
    [5, -34],
    [-5, -25],
    [-15, -6],
    [-17, 15],
    [-7, 29],
    [-17, 37],
  ],
  [
    [-10, 36],
    [-6, 45],
    [5, 53],
    [20, 59],
    [35, 60],
    [50, 70],
    [80, 75],
    [110, 72],
    [145, 66],
    [170, 55],
    [155, 45],
    [140, 36],
    [124, 32],
    [119, 22],
    [106, 10],
    [96, 5],
    [80, 8],
    [68, 23],
    [55, 26],
    [47, 40],
    [35, 43],
    [25, 36],
    [15, 43],
    [5, 40],
    [-10, 36],
  ],
  [
    [68, 24],
    [76, 8],
    [82, 6],
    [90, 22],
    [80, 30],
    [68, 24],
  ],
  [
    [113, -12],
    [130, -11],
    [145, -18],
    [153, -28],
    [145, -39],
    [125, -35],
    [113, -25],
    [113, -12],
  ],
  [
    [-180, -70],
    [-135, -73],
    [-90, -69],
    [-45, -76],
    [0, -70],
    [45, -75],
    [90, -68],
    [135, -73],
    [180, -70],
  ],
] as const;

function lonLatToThree([longitudeDeg, latitudeDeg]: LonLat): THREE.Vector3 {
  const [x, y, z] = earthFixedToThree(geodeticSurfaceUnitEarthFixed(latitudeDeg, longitudeDeg));
  return new THREE.Vector3(x, y, z).multiplyScalar(1.0025);
}

export function createContinentOutlines(
  observerLatitudeDeg: number,
  observerLongitudeDeg: number,
): THREE.LineSegments {
  const points: number[] = [];

  for (const coastline of COASTLINES) {
    for (let index = 1; index < coastline.length; index += 1) {
      const start = lonLatToThree(coastline[index - 1]!);
      const end = lonLatToThree(coastline[index]!);
      points.push(start.x, start.y, start.z, end.x, end.y, end.z);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x77d4c9,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const outlines = new THREE.LineSegments(geometry, material);

  const observerEarthFixed = geodeticSurfaceUnitEarthFixed(
    observerLatitudeDeg,
    observerLongitudeDeg,
  );
  const [observerX, observerY, observerZ] = earthFixedToThree(observerEarthFixed);
  const observerDirection = new THREE.Vector3(observerX, observerY, observerZ).normalize();
  outlines.quaternion.setFromUnitVectors(observerDirection, new THREE.Vector3(0, 1, 0));
  outlines.renderOrder = 1;

  return outlines;
}
