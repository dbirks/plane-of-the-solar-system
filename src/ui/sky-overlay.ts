import * as THREE from "three/webgpu";

import type { SkyBodyId, SkyBodyState, SkyState } from "../astronomy/sky-state";
import type { Vec3d } from "../coordinates/vec3d";

/**
 * Screen-space marker and compass overlay. The renderer drives this directly
 * every frame (React renders none of it), matching the architecture rule that
 * markers are UI projected from scene state, never scene objects.
 */
export type SkyOverlayHandlers = {
  onLook: (azimuthDeg: number, altitudeDeg: number) => void;
  onSelect: (bodyId: SkyBodyId) => void;
};

/** Live Moon placement injected per frame (the Moon leaves the sky proxy). */
export type MoonMarkerOverride = {
  directionLocalThree: Vec3d;
  altitudeDeg: number;
  azimuthDeg: number;
  physical: boolean;
};

type MarkerEntry = {
  element: HTMLButtonElement;
  body: SkyBodyState;
  lookAltitudeDeg: number;
  lookAzimuthDeg: number;
  screenX: number;
  screenY: number;
  visible: boolean;
};

const TAP_RADIUS_PX = 26;

// Sky-proxy markers fade on ascent; the Moon's marker persists because the
// Moon itself is physical (SPEC Phase 3: the marker remains selectable).
const PROXY_FADE_START_ALTITUDE_M = 80_000;
const PROXY_FADE_END_ALTITUDE_M = 400_000;

function smoothstepNumber(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export type PlaneGuideAnchor = {
  /** Unit direction of a point on the ecliptic, local frame. */
  direction: readonly [number, number, number];
  /** A nearby point further along the band, for the caption's screen slope. */
  directionAhead: readonly [number, number, number];
};

export class SkyOverlay {
  private readonly root: HTMLElement;
  private readonly layer: HTMLDivElement;
  private readonly markers = new Map<string, MarkerEntry>();
  private readonly handlers: SkyOverlayHandlers;
  private readonly workVector = new THREE.Vector3();
  private readonly workVectorAhead = new THREE.Vector3();
  private planeCaptions: HTMLSpanElement[] = [];

  constructor(root: HTMLElement, handlers: SkyOverlayHandlers) {
    this.root = root;
    this.handlers = handlers;
    this.layer = document.createElement("div");
    this.layer.className = "sky-marker-layer";
    this.layer.setAttribute("aria-label", "Sky object markers");
    this.root.appendChild(this.layer);
  }

  /** Rebuild marker bindings from a fresh astronomy snapshot (~1 Hz). */
  setSky(sky: SkyState): void {
    // Synthetic Earth entry: only shown at system scale via overrides, with
    // top label priority (it is where the viewer lives). Never a sky proxy.
    const earthBody = {
      ...sky.moon,
      id: "earth",
      label: "Earth",
      magnitude: -99,
    } as unknown as SkyBodyState;
    const bodies: SkyBodyState[] = [sky.sun, sky.moon, earthBody, ...sky.planets];
    for (const body of bodies) {
      let entry = this.markers.get(body.id);
      if (!entry) {
        const element = document.createElement("button");
        element.type = "button";
        element.className = "sky-marker";
        element.dataset["body"] = body.id;
        const ring = document.createElement("span");
        ring.className = "sky-marker-ring";
        const label = document.createElement("span");
        label.className = "sky-marker-label";
        label.textContent = body.label;
        element.append(ring, label);
        // Markers are pointer-transparent so the canvas keeps drag and wheel
        // everywhere; taps are routed back via handleTap(). The click listener
        // still serves keyboard activation (focus + Enter).
        element.addEventListener("click", () => {
          const current = this.markers.get(body.id);
          if (current) this.activate(current);
        });
        this.layer.appendChild(element);
        entry = {
          element,
          body,
          lookAltitudeDeg: body.altitudeDeg,
          lookAzimuthDeg: body.azimuthDeg,
          screenX: -1,
          screenY: -1,
          visible: false,
        };
        this.markers.set(body.id, entry);
      }
      entry.body = body;
      entry.lookAltitudeDeg = body.altitudeDeg;
      entry.lookAzimuthDeg = body.azimuthDeg;
      const below = body.altitudeDeg < 0;
      entry.element.classList.toggle("sky-marker--ghost", below);
      entry.element.setAttribute(
        "aria-label",
        below
          ? `${body.label}, below the horizon toward ${Math.round(body.azimuthDeg)} degrees`
          : `${body.label}, ${Math.round(body.altitudeDeg)} degrees above the horizon`,
      );
    }
  }

  /** Per-frame: project markers and slide the compass strip. */
  update(
    camera: THREE.PerspectiveCamera,
    headingDeg: number,
    altitudeM: number,
    overrides?: Map<string, MoonMarkerOverride>,
    systemReveal = 0,
    prefs: { labels: boolean; belowHorizon: boolean } = { labels: true, belowHorizon: true },
    planeGuides?: { anchors: readonly PlaneGuideAnchor[]; opacity: number },
  ): void {
    const proxyOpacity =
      1 - smoothstepNumber(PROXY_FADE_START_ALTITUDE_M, PROXY_FADE_END_ALTITUDE_M, altitudeM);

    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    if (width > 0 && height > 0) {
      for (const entry of this.markers.values()) {
        const isMoon = entry.body.id === "moon";
        const override = overrides?.get(entry.body.id);
        const ghosted = entry.element.classList.contains("sky-marker--ghost");
        // The Moon's marker persists (physical body); other markers show at
        // ground scale as sky proxies and again at system scale. Earth only
        // exists at system scale (there is no Earth in Earth's sky).
        let opacity =
          entry.body.id === "earth"
            ? override
              ? systemReveal
              : 0
            : isMoon
              ? 1
              : Math.max(proxyOpacity, override ? systemReveal : 0);
        if (ghosted && !prefs.belowHorizon) opacity = 0;
        if (opacity <= 0.02) {
          entry.visible = false;
          if (entry.element.style.display !== "none") entry.element.style.display = "none";
          continue;
        }
        entry.element.style.opacity = opacity.toFixed(3);

        let direction = entry.body.directionLocalThree;
        if (override) {
          direction = override.directionLocalThree;
          entry.lookAltitudeDeg = override.altitudeDeg;
          entry.lookAzimuthDeg = override.azimuthDeg;
          if (override.physical) entry.element.classList.remove("sky-marker--ghost");
        }

        const [x, y, z] = direction;
        // View space first: points behind the camera mirror through the
        // projection, so handle view-space z before projecting.
        this.workVector.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
        const inFront = this.workVector.z < 0;
        let ndcX: number;
        let ndcY: number;
        let atEdge = false;
        if (inFront) {
          this.workVector.applyMatrix4(camera.projectionMatrix);
          ndcX = this.workVector.x;
          ndcY = this.workVector.y;
          const overflow = Math.max(Math.abs(ndcX), Math.abs(ndcY));
          if (overflow > 1.02) {
            // Off-frustum but ahead: pin to the edge along the same direction.
            atEdge = true;
            ndcX = (ndcX / overflow) * 0.94;
            ndcY = (ndcY / overflow) * 0.94;
          }
        } else {
          // Behind the camera: point from screen center toward the body's
          // sideways direction so a click can still swing the view there.
          atEdge = true;
          const planar = Math.hypot(this.workVector.x, this.workVector.y);
          const directionX = planar > 1e-6 ? this.workVector.x / planar : 0;
          const directionY = planar > 1e-6 ? this.workVector.y / planar : -1;
          ndcX = directionX * 0.94;
          ndcY = directionY * 0.94;
        }
        if (entry.element.style.display === "none") entry.element.style.display = "";
        entry.element.classList.toggle("sky-marker--edge", atEdge);
        const screenX = ((ndcX + 1) / 2) * width;
        const screenY = ((1 - ndcY) / 2) * height;
        entry.screenX = screenX;
        entry.screenY = screenY;
        entry.visible = true;
        entry.element.style.transform = `translate(${screenX.toFixed(1)}px, ${screenY.toFixed(1)}px)`;
      }

      // Label declutter: brightest bodies keep their labels; a label within
      // 34 px of an already-labeled marker hides (the ring stays selectable).
      const labelOrder = [...this.markers.values()]
        .filter((entry) => entry.visible)
        .sort((a, b) => a.body.magnitude - b.body.magnitude);
      const labeled: MarkerEntry[] = [];
      for (const entry of labelOrder) {
        const collides = labeled.some(
          (kept) => Math.hypot(kept.screenX - entry.screenX, kept.screenY - entry.screenY) < 34,
        );
        const showLabel = prefs.labels && !collides;
        entry.element.classList.toggle("sky-marker--nolabel", !showLabel);
        if (showLabel) labeled.push(entry);
      }
    }

    this.updatePlaneCaptions(camera, width, height, planeGuides);

    const strip = document.getElementById("compass-strip");
    const window = strip?.parentElement;
    if (strip && window) {
      const pxPerDeg = 4;
      const centerPx = window.clientWidth / 2;
      // Strip coordinates place azimuth -180° at x = 0.
      const offset = centerPx - (headingDeg + 180) * pxPerDeg;
      strip.style.transform = `translateX(${offset.toFixed(1)}px)`;
    }
  }

  /**
   * Hit-test a canvas tap against the last projected marker positions.
   * Returns true when the tap engaged a marker.
   */
  handleTap(clientX: number, clientY: number): boolean {
    const rect = this.root.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    let best: MarkerEntry | null = null;
    let bestDistance = TAP_RADIUS_PX;
    for (const entry of this.markers.values()) {
      if (!entry.visible) continue;
      const distance = Math.hypot(entry.screenX - localX, entry.screenY - localY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = entry;
      }
    }
    if (!best) return false;
    this.activate(best);
    return true;
  }

  private activate(entry: MarkerEntry): void {
    this.handlers.onLook(entry.lookAzimuthDeg, entry.lookAltitudeDeg);
    this.handlers.onSelect(entry.body.id);
  }

  /**
   * "Plane of the solar system" captions riding the ecliptic band: each
   * anchor is projected like a marker and the caption rotates to the band's
   * local screen slope. Anchors behind the camera or off-frame simply hide.
   */
  private updatePlaneCaptions(
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    planeGuides?: { anchors: readonly PlaneGuideAnchor[]; opacity: number },
  ): void {
    const anchors = planeGuides?.anchors ?? [];
    while (this.planeCaptions.length < anchors.length) {
      const caption = document.createElement("span");
      caption.className = "plane-caption";
      caption.textContent = "Plane of the solar system";
      caption.setAttribute("aria-hidden", "true");
      this.layer.appendChild(caption);
      this.planeCaptions.push(caption);
    }
    for (let i = 0; i < this.planeCaptions.length; i += 1) {
      const caption = this.planeCaptions[i]!;
      const anchor = anchors[i];
      const opacity = planeGuides?.opacity ?? 0;
      if (!anchor || opacity <= 0.02 || width <= 0 || height <= 0) {
        caption.style.display = "none";
        continue;
      }
      this.workVector.set(...anchor.direction).applyMatrix4(camera.matrixWorldInverse);
      this.workVectorAhead.set(...anchor.directionAhead).applyMatrix4(camera.matrixWorldInverse);
      if (this.workVector.z >= 0 || this.workVectorAhead.z >= 0) {
        caption.style.display = "none";
        continue;
      }
      this.workVector.applyMatrix4(camera.projectionMatrix);
      this.workVectorAhead.applyMatrix4(camera.projectionMatrix);
      if (Math.abs(this.workVector.x) > 0.92 || Math.abs(this.workVector.y) > 0.86) {
        caption.style.display = "none";
        continue;
      }
      const screenX = ((this.workVector.x + 1) / 2) * width;
      const screenY = ((1 - this.workVector.y) / 2) * height;
      const aheadX = ((this.workVectorAhead.x + 1) / 2) * width;
      const aheadY = ((1 - this.workVectorAhead.y) / 2) * height;
      const slopeDeg = (Math.atan2(aheadY - screenY, aheadX - screenX) * 180) / Math.PI;
      // Keep the text upright: flip when the band runs right-to-left.
      const uprightDeg = slopeDeg > 90 ? slopeDeg - 180 : slopeDeg < -90 ? slopeDeg + 180 : slopeDeg;
      caption.style.display = "";
      caption.style.opacity = opacity.toFixed(3);
      caption.style.transform =
        `translate(${screenX.toFixed(1)}px, ${screenY.toFixed(1)}px) ` +
        `rotate(${uprightDeg.toFixed(2)}deg) translate(-50%, -50%)`;
    }
  }

  dispose(): void {
    this.layer.remove();
    this.markers.clear();
  }
}
