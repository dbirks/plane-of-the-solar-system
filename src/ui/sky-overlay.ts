import * as THREE from "three/webgpu";

import type { SkyBodyState, SkyState } from "../astronomy/sky-state";

/**
 * Screen-space marker and compass overlay. The renderer drives this directly
 * every frame (React renders none of it), matching the architecture rule that
 * markers are UI projected from scene state, never scene objects.
 */
export type LookHandler = (azimuthDeg: number, altitudeDeg: number) => void;

type MarkerEntry = {
  element: HTMLButtonElement;
  body: SkyBodyState;
};

const LAYER_FADE_START_ALTITUDE_M = 80_000;
const LAYER_FADE_END_ALTITUDE_M = 400_000;

function smoothstepNumber(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export class SkyOverlay {
  private readonly root: HTMLElement;
  private readonly layer: HTMLDivElement;
  private readonly markers = new Map<string, MarkerEntry>();
  private readonly onLook: LookHandler;
  private readonly workVector = new THREE.Vector3();

  constructor(root: HTMLElement, onLook: LookHandler) {
    this.root = root;
    this.onLook = onLook;
    this.layer = document.createElement("div");
    this.layer.className = "sky-marker-layer";
    this.layer.setAttribute("aria-label", "Sky object markers");
    this.root.appendChild(this.layer);
  }

  /** Rebuild marker bindings from a fresh astronomy snapshot (~1 Hz). */
  setSky(sky: SkyState): void {
    const bodies: SkyBodyState[] = [sky.sun, sky.moon, ...sky.planets];
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
        element.addEventListener("click", () => {
          const current = this.markers.get(body.id);
          if (current) this.onLook(current.body.azimuthDeg, current.body.altitudeDeg);
        });
        this.layer.appendChild(element);
        entry = { element, body };
        this.markers.set(body.id, entry);
      }
      entry.body = body;
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
  update(camera: THREE.PerspectiveCamera, headingDeg: number, altitudeM: number): void {
    const layerOpacity =
      1 - smoothstepNumber(LAYER_FADE_START_ALTITUDE_M, LAYER_FADE_END_ALTITUDE_M, altitudeM);
    this.layer.style.opacity = layerOpacity.toFixed(3);
    this.layer.style.pointerEvents = layerOpacity < 0.2 ? "none" : "";
    if (layerOpacity <= 0.003) {
      if (this.layer.style.display !== "none") this.layer.style.display = "none";
    } else if (this.layer.style.display === "none") {
      this.layer.style.display = "";
    }

    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    if (layerOpacity > 0.003 && width > 0 && height > 0) {
      for (const entry of this.markers.values()) {
        const [x, y, z] = entry.body.directionLocalThree;
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
        entry.element.style.transform = `translate(${screenX.toFixed(1)}px, ${screenY.toFixed(1)}px)`;
      }
    }

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

  dispose(): void {
    this.layer.remove();
    this.markers.clear();
  }
}
