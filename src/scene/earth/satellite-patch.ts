import * as THREE from "three/webgpu";

/**
 * Close-up satellite imagery around the observer (SPEC exception, user
 * opt-in by design: coordinates already live in the URL, and viewing the
 * close-up fetches public map tiles for that area from Esri World Imagery —
 * documented in the chip copy and credits).
 *
 * Four nested web-mercator patches (zooms 16/13/10/7), each a 4×4-tile
 * canvas draped on a ground-aligned quad centered near the observer. Tiles
 * persist in the Cache API so revisits render offline-fast without
 * re-downloading. The whole group fades in as the map view takes over
 * (~20–60 m up) and hands off to the Blue Marble globe on the way out.
 */

const TILE_SOURCE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";
export const TILE_ATTRIBUTION = "Imagery © Esri, Maxar, Earthstar Geographics";
const TILE_CACHE = "satellite-tiles-v1";
const TILES_PER_SIDE = 4;
const TILE_PX = 256;

/** Patch zoom levels, sharpest first, with per-level visibility ceilings.
 * z18 ≈ 0.6 m/px keeps the first few hundred meters street-sharp. */
const PATCH_LEVELS = [
  { zoom: 18, maxAltitudeM: 5_000 },
  { zoom: 15, maxAltitudeM: 45_000 },
  { zoom: 12, maxAltitudeM: 350_000 },
  { zoom: 9, maxAltitudeM: Number.POSITIVE_INFINITY },
] as const;

const METERS_PER_DEG_LAT = 110_574;

export function tileXY(latitudeDeg: number, longitudeDeg: number, zoom: number) {
  const n = 2 ** zoom;
  const latRad = (latitudeDeg * Math.PI) / 180;
  return {
    x: ((longitudeDeg + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  };
}

export function tileBounds(tileX: number, tileY: number, zoom: number) {
  const n = 2 ** zoom;
  const lonOf = (x: number) => (x / n) * 360 - 180;
  const latOf = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return {
    westDeg: lonOf(tileX),
    eastDeg: lonOf(tileX + 1),
    northDeg: latOf(tileY),
    southDeg: latOf(tileY + 1),
  };
}

async function fetchTile(zoom: number, x: number, y: number): Promise<ImageBitmap | null> {
  const url = `${TILE_SOURCE}/${zoom}/${y}/${x}`;
  // Bursts of 64 tiles can hit provider throttling and spotty mobile
  // networks — retry a few times with backoff before giving up.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const cache = "caches" in window ? await caches.open(TILE_CACHE) : null;
      let response = (await cache?.match(url)) ?? null;
      if (!response) {
        response = await fetch(url, { mode: "cors" });
        if (!response.ok) throw new Error(`tile ${response.status}`);
        await cache?.put(url, response.clone());
      }
      return await createImageBitmap(await response.blob());
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  return null;
}

type Patch = {
  zoom: number;
  maxAltitudeM: number;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  /** Ground offsets/extent in meters relative to the observer. */
  centerEastM: number;
  centerNorthM: number;
  widthM: number;
  heightM: number;
  loaded: boolean;
};

export class SatellitePatches {
  readonly group = new THREE.Group();
  private readonly patches: Patch[] = [];
  private disposed = false;

  constructor(observerLatitudeDeg: number, observerLongitudeDeg: number) {
    for (const level of PATCH_LEVELS) {
      const canvas = document.createElement("canvas");
      canvas.width = TILES_PER_SIDE * TILE_PX;
      canvas.height = TILES_PER_SIDE * TILE_PX;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      mesh.rotation.x = -Math.PI / 2;
      // Sharper levels draw over coarser ones.
      mesh.renderOrder = 1 + level.zoom / 20;
      // Like every scaled object in this scene: culling misjudges the
      // per-frame rescaled bounds (and the reversed depth projection).
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.group.add(mesh);

      const origin = tileXY(observerLatitudeDeg, observerLongitudeDeg, level.zoom);
      const tileX0 = Math.floor(origin.x) - TILES_PER_SIDE / 2 + 1;
      const tileY0 = Math.floor(origin.y) - TILES_PER_SIDE / 2 + 1;
      const west = tileBounds(tileX0, tileY0, level.zoom);
      const east = tileBounds(tileX0 + TILES_PER_SIDE - 1, tileY0 + TILES_PER_SIDE - 1, level.zoom);
      const metersPerDegLon =
        METERS_PER_DEG_LAT * Math.cos((observerLatitudeDeg * Math.PI) / 180);
      const widthM = (east.eastDeg - west.westDeg) * metersPerDegLon;
      const heightM = (west.northDeg - east.southDeg) * METERS_PER_DEG_LAT;
      const centerEastM =
        ((west.westDeg + east.eastDeg) / 2 - observerLongitudeDeg) * metersPerDegLon;
      const centerNorthM =
        ((west.northDeg + east.southDeg) / 2 - observerLatitudeDeg) * METERS_PER_DEG_LAT;

      const patch: Patch = {
        zoom: level.zoom,
        maxAltitudeM: level.maxAltitudeM,
        mesh,
        material,
        centerEastM,
        centerNorthM,
        widthM,
        heightM,
        loaded: false,
      };
      this.patches.push(patch);

      void this.loadPatch(patch, canvas, texture, tileX0, tileY0);
    }
  }

  private async loadPatch(
    patch: Patch,
    canvas: HTMLCanvasElement,
    texture: THREE.CanvasTexture,
    tileX0: number,
    tileY0: number,
  ): Promise<void> {
    const context = canvas.getContext("2d");
    if (!context) return;
    // Neutral ground tone beneath the tiles: a failed tile becomes a muted
    // square, never a transparent-black hole.
    context.fillStyle = "#2c3a33";
    context.fillRect(0, 0, canvas.width, canvas.height);
    let landed = 0;
    const jobs: Promise<void>[] = [];
    for (let row = 0; row < TILES_PER_SIDE; row += 1) {
      for (let column = 0; column < TILES_PER_SIDE; column += 1) {
        jobs.push(
          fetchTile(patch.zoom, tileX0 + column, tileY0 + row).then((bitmap) => {
            if (!bitmap || this.disposed) return;
            context.drawImage(bitmap, column * TILE_PX, row * TILE_PX);
            bitmap.close();
            landed += 1;
          }),
        );
      }
    }
    await Promise.allSettled(jobs);
    if (this.disposed) return;
    // Reveal the patch only once loading has SETTLED and most tiles are in —
    // tile-by-tile pop-in read as flashing on-device, and the neutral fill
    // keeps any stragglers as muted squares rather than holes.
    if (landed >= (TILES_PER_SIDE * TILES_PER_SIDE) / 2) {
      texture.needsUpdate = true;
      patch.loaded = true;
    }
  }

  /**
   * Per frame: sit the patches on the ground under the observer and blend
   * them by altitude — in with the map view, out to the Blue Marble.
   */
  update(
    observerSurfaceRender: THREE.Vector3,
    renderUnitsPerMeter: number,
    altitudeM: number,
  ): void {
    const fadeIn = smoothstep(15, 55, altitudeM);
    const fadeOut = 1 - smoothstep(300_000, 1_200_000, altitudeM);
    const groupOpacity = fadeIn * fadeOut;
    for (const patch of this.patches) {
      // Long overlap between levels: the coarser patch is already fully
      // present underneath before the finer one thins out. The widest level
      // has no ceiling (Infinity would NaN the smoothstep — it never drew).
      const levelFade = Number.isFinite(patch.maxAltitudeM)
        ? 1 - smoothstep(patch.maxAltitudeM * 0.35, patch.maxAltitudeM, altitudeM)
        : 1;
      const opacity = groupOpacity * levelFade;
      patch.mesh.visible = patch.loaded && opacity > 0.01;
      patch.material.opacity = opacity;
      if (!patch.mesh.visible) continue;
      patch.mesh.position.set(
        observerSurfaceRender.x + patch.centerEastM * renderUnitsPerMeter,
        observerSurfaceRender.y + (2 + patch.zoom * 0.4) * renderUnitsPerMeter,
        observerSurfaceRender.z - patch.centerNorthM * renderUnitsPerMeter,
      );
      patch.mesh.scale.set(
        patch.widthM * renderUnitsPerMeter,
        patch.heightM * renderUnitsPerMeter,
        1,
      );
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const patch of this.patches) {
      patch.material.map?.dispose();
      patch.material.dispose();
      patch.mesh.geometry.dispose();
    }
  }
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
