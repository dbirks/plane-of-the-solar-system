// Functional TSL forms only (see ADR-0003 amendment).
import { add, clamp, dot, mix, mul, normalWorld, texture, vec3 } from "three/tsl";
import * as THREE from "three/webgpu";

/**
 * Day/night textured globe material. Self-shaded from the true Sun direction
 * (the terminator is physical geometry, matching the Moon's treatment):
 * NASA Blue Marble by day, Black Marble city lights on the night side.
 */
export function createEarthGlobeMaterial(
  dayTexture: THREE.Texture,
  nightTexture: THREE.Texture,
  sunDirectionNode: Parameters<typeof dot>[1],
  surfaceFlattenNode: Parameters<typeof mix>[2],
): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial();
  const lit = clamp(add(mul(dot(normalWorld, sunDirectionNode), 3.5), 0.12), 0, 1);
  const dayColor = texture(dayTexture);
  const nightColor = texture(nightTexture);
  const nightGlow = add(mul(nightColor, vec3(1.2, 1.0, 0.72)), mul(dayColor, vec3(0.05)));
  const texturedColor = mix(nightGlow, dayColor, lit);
  // Up close the imagery is below its native resolution and reads as blur —
  // `surfaceFlattenNode` (1 near the ground, 0 past low orbit) swaps in a
  // clean stylized tone, still shaded by the same physical terminator.
  const flatColor = mix(vec3(0.008, 0.016, 0.026), vec3(0.1, 0.17, 0.22), lit);
  material.colorNode = mix(texturedColor, flatColor, surfaceFlattenNode);
  return material;
}

/** Load both Earth textures; resolves null if either fails (keep flat shading). */
export async function loadEarthTextures(baseUrl: string): Promise<{
  day: THREE.Texture;
  night: THREE.Texture;
} | null> {
  try {
    const loader = new THREE.TextureLoader();
    const [day, night] = await Promise.all([
      loader.loadAsync(`${baseUrl}textures/earth-day-4096.jpg`),
      loader.loadAsync(`${baseUrl}textures/earth-night-2048.jpg`),
    ]);
    for (const map of [day, night]) {
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 4;
    }
    return { day, night };
  } catch {
    return null;
  }
}
