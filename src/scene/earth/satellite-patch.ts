import * as THREE from "three/webgpu";

/**
 * Close-up satellite imagery around the observer (SPEC exception, user
 * opt-in by design: coordinates already live in the URL, and viewing the
 * close-up fetches public map tiles for that area from Esri World Imagery
 * and NASA GIBS — documented in the chip copy and credits).
 *
 * Seven nested web-mercator patches (zooms 18…6, every two steps), each a
 * 4×4-tile canvas draped on a ground-aligned quad centered near the
 * observer — close spacing so the pull-out degrades smoothly instead of
 * jumping between sharp and blurry, and the widest (~1,900 km) never shows
 * a blank ring before the Blue Marble takeover. At night the wide levels
 * additionally carry NASA's VIIRS Black Marble city lights, blended in as
 * the sky darkens. Tiles persist in the Cache API so revisits render
 * offline-fast without re-downloading. The whole group fades in as the map
 * view takes over (~25–60 m up, after the nadir drop) and hands off to the
 * globe on the way out.
 */

const TILE_SOURCE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";
/** NASA GIBS: VIIRS Black Marble (2016 composite), web-mercator, z0–8. */
const NIGHT_TILE_SOURCE =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/default/GoogleMapsCompatible_Level8";
export const TILE_ATTRIBUTION = "Imagery © Esri, Maxar, Earthstar Geographics · Night: NASA VIIRS";
const TILE_CACHE = "satellite-tiles-v1";
const TILES_PER_SIDE = 4;
const TILE_PX = 256;

/** Patch zoom levels, sharpest first, with per-level visibility ceilings.
 * z18 ≈ 0.6 m/px keeps the first few hundred meters street-sharp; two-step
 * spacing keeps each handoff a gentle blur, not a jump. */
const PATCH_LEVELS = [
  { zoom: 18, maxAltitudeM: 5_000 },
  { zoom: 16, maxAltitudeM: 20_000 },
  { zoom: 14, maxAltitudeM: 80_000 },
  { zoom: 12, maxAltitudeM: 300_000 },
  { zoom: 10, maxAltitudeM: 900_000 },
  { zoom: 8, maxAltitudeM: 2_500_000 },
  { zoom: 6, maxAltitudeM: Number.POSITIVE_INFINITY },
] as const;

/** GIBS Black Marble tops out at z8: the wide levels carry the night lights. */
const NIGHT_MAX_ZOOM = 8;

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

async function fetchTile(url: string): Promise<ImageBitmap | null> {
  // Bursts of tiles can hit provider throttling and spotty mobile
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
  /** VIIRS city lights riding the same footprint (wide levels only). */
  nightMesh: THREE.Mesh | null;
  nightMaterial: THREE.MeshBasicMaterial | null;
  /** Ground offsets/extent in meters relative to the observer. */
  centerEastM: number;
  centerNorthM: number;
  widthM: number;
  heightM: number;
  loaded: boolean;
  nightLoaded: boolean;
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
        // No depth test either: flat quads lifted meters over a spherical
        // terrain z-fight along the curvature (frame-to-frame "spazzing").
        // renderOrder alone layers them — over the ground, under the marker.
        depthTest: false,
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
      const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((observerLatitudeDeg * Math.PI) / 180);
      const widthM = (east.eastDeg - west.westDeg) * metersPerDegLon;
      const heightM = (west.northDeg - east.southDeg) * METERS_PER_DEG_LAT;
      const centerEastM =
        ((west.westDeg + east.eastDeg) / 2 - observerLongitudeDeg) * metersPerDegLon;
      const centerNorthM =
        ((west.northDeg + east.southDeg) / 2 - observerLatitudeDeg) * METERS_PER_DEG_LAT;

      // City lights on the wide levels: an additive quad just above the day
      // imagery, so night streets glow instead of going flat gray.
      let nightMesh: THREE.Mesh | null = null;
      let nightMaterial: THREE.MeshBasicMaterial | null = null;
      let nightCanvas: HTMLCanvasElement | null = null;
      let nightTexture: THREE.CanvasTexture | null = null;
      if (level.zoom <= NIGHT_MAX_ZOOM) {
        nightCanvas = document.createElement("canvas");
        nightCanvas.width = TILES_PER_SIDE * TILE_PX;
        nightCanvas.height = TILES_PER_SIDE * TILE_PX;
        nightTexture = new THREE.CanvasTexture(nightCanvas);
        nightTexture.colorSpace = THREE.SRGBColorSpace;
        nightTexture.anisotropy = 4;
        nightMaterial = new THREE.MeshBasicMaterial({
          map: nightTexture,
          // Warm amber tint: raw VIIRS added at strength turns a whole
          // metro area into daylight-gray — tinted and capped it reads as
          // city glow instead.
          color: new THREE.Color(0.95, 0.72, 0.45),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        });
        nightMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), nightMaterial);
        nightMesh.rotation.x = -Math.PI / 2;
        // Above every day level (max 1.9), below the observer marker (2.5).
        nightMesh.renderOrder = 2.1 + level.zoom / 100;
        nightMesh.frustumCulled = false;
        nightMesh.visible = false;
        this.group.add(nightMesh);
      }

      const patch: Patch = {
        zoom: level.zoom,
        maxAltitudeM: level.maxAltitudeM,
        mesh,
        material,
        nightMesh,
        nightMaterial,
        centerEastM,
        centerNorthM,
        widthM,
        heightM,
        loaded: false,
        nightLoaded: false,
      };
      this.patches.push(patch);

      void this.loadPatch(
        canvas,
        texture,
        tileX0,
        tileY0,
        (x, y) => `${TILE_SOURCE}/${level.zoom}/${y}/${x}`,
        "#2c3a33",
        () => {
          patch.loaded = true;
        },
      );
      if (nightCanvas && nightTexture) {
        void this.loadPatch(
          nightCanvas,
          nightTexture,
          tileX0,
          tileY0,
          (x, y) => `${NIGHT_TILE_SOURCE}/${level.zoom}/${y}/${x}.png`,
          // Additive: black adds nothing, so a failed tile simply stays dark.
          "#000000",
          () => {
            patch.nightLoaded = true;
          },
        );
      }
    }
  }

  private async loadPatch(
    canvas: HTMLCanvasElement,
    texture: THREE.CanvasTexture,
    tileX0: number,
    tileY0: number,
    urlFor: (x: number, y: number) => string,
    fillStyle: string,
    onLoaded: () => void,
  ): Promise<void> {
    const context = canvas.getContext("2d");
    if (!context) return;
    // Neutral tone beneath the tiles: a failed tile becomes a muted square
    // (or stays dark on the additive night layer), never a hole.
    context.fillStyle = fillStyle;
    context.fillRect(0, 0, canvas.width, canvas.height);
    let landed = 0;
    const jobs: Promise<void>[] = [];
    for (let row = 0; row < TILES_PER_SIDE; row += 1) {
      for (let column = 0; column < TILES_PER_SIDE; column += 1) {
        jobs.push(
          fetchTile(urlFor(tileX0 + column, tileY0 + row)).then((bitmap) => {
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
      onLoaded();
    }
  }

  /**
   * Per frame: sit the patches on the ground under the observer and blend
   * them by altitude — in with the map view (after the nadir drop), out to
   * the Blue Marble. `daylight` (0 night – 1 day) dims the imagery toward a
   * cool night tone and raises the VIIRS city lights so the map matches the
   * sky's actual hour.
   */
  update(
    observerSurfaceRender: THREE.Vector3,
    renderUnitsPerMeter: number,
    altitudeM: number,
    daylight = 1,
  ): void {
    const fadeIn = smoothstep(25, 60, altitudeM);
    const fadeOut = 1 - smoothstep(300_000, 1_200_000, altitudeM);
    const groupOpacity = fadeIn * fadeOut;
    // The lights arrive once high enough that z8's ~600 m/px reads sharp —
    // below that the cool-dimmed streets already carry the night. Capped at
    // 0.45: additive VIIRS at full strength whites out a whole metro area
    // (the ACES tonemap saturates), and the two night levels CROSSFADE
    // below rather than stack — stacked they doubled the glow.
    const nightReach = smoothstep(25_000, 70_000, altitudeM) * (1 - daylight) * 0.3;
    const nightWideBlend = smoothstep(250_000, 450_000, altitudeM);
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
      if (patch.nightMesh && patch.nightMaterial) {
        const nightLevelFade = patch.zoom === 8 ? 1 - nightWideBlend : nightWideBlend;
        const nightOpacity = groupOpacity * nightReach * nightLevelFade;
        patch.nightMesh.visible = patch.nightLoaded && nightOpacity > 0.01;
        patch.nightMaterial.opacity = nightOpacity;
      }
      if (!patch.mesh.visible && !patch.nightMesh?.visible) continue;
      // Night falls on the map too: cool-blue dim, not pure black, so
      // streets stay legible the way a moonlit ground does.
      patch.material.color.setRGB(
        0.2 + 0.8 * daylight,
        0.26 + 0.74 * daylight,
        0.38 + 0.62 * daylight,
      );
      const positionX = observerSurfaceRender.x + patch.centerEastM * renderUnitsPerMeter;
      const positionZ = observerSurfaceRender.z - patch.centerNorthM * renderUnitsPerMeter;
      const scaleX = patch.widthM * renderUnitsPerMeter;
      const scaleY = patch.heightM * renderUnitsPerMeter;
      patch.mesh.position.set(
        positionX,
        observerSurfaceRender.y + (2 + patch.zoom * 0.4) * renderUnitsPerMeter,
        positionZ,
      );
      patch.mesh.scale.set(scaleX, scaleY, 1);
      if (patch.nightMesh) {
        patch.nightMesh.position.set(
          positionX,
          observerSurfaceRender.y + (3 + patch.zoom * 0.4) * renderUnitsPerMeter,
          positionZ,
        );
        patch.nightMesh.scale.set(scaleX, scaleY, 1);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const patch of this.patches) {
      patch.material.map?.dispose();
      patch.material.dispose();
      patch.mesh.geometry.dispose();
      patch.nightMaterial?.map?.dispose();
      patch.nightMaterial?.dispose();
      if (patch.nightMesh) patch.nightMesh.geometry.dispose();
    }
  }
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
