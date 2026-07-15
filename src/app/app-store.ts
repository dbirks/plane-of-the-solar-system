import { create } from "zustand";

import type { SkyBodyId } from "../astronomy/sky-state";
import { JOURNEY_MIN_DISTANCE_M } from "../camera/scale-domains";

export type RendererTelemetry = {
  backend: string;
  currentDistanceM: number;
  scaleDomain: string;
  fps: number;
  averageFrameMs: number;
  worstFrameMs: number;
  drawCalls: number;
  geometries: number;
  textures: number;
  renderScale: number;
  estimatedJitterM: number;
  orientationOffsetDeg: number;
  /** Camera compass heading at the ground: 0 north, 90 east. */
  headingDeg: number;
  simulationUtcMs: number;
};

/** Low-frequency (~1 Hz) astronomy readout published by the renderer. */
export type SkyReadout = {
  sunAltitudeDeg: number;
  sunAzimuthDeg: number;
  moonAltitudeDeg: number;
  moonAzimuthDeg: number;
  moonIlluminatedFraction: number;
  moonPhaseDeg: number;
  moonDistanceM: number;
  visibleStarCount: number;
  /** One entry per body for selection info (Sun, Moon, planets to Pluto). */
  bodies: readonly BodyReadout[];
};

/** Optional explanation layers (SPEC §12); geometry stays sparse by default. */
export type LayerId =
  | "orbit-lines"
  | "ecliptic-rings"
  | "moon-orbit"
  | "sun-guide"
  | "earth-axis"
  | "sky-grid"
  | "marker-labels"
  | "below-horizon-markers";

export type LayersState = Record<LayerId, boolean>;

export const DEFAULT_LAYERS: LayersState = {
  "orbit-lines": true,
  "ecliptic-rings": true,
  "moon-orbit": true,
  "sun-guide": true,
  "earth-axis": false,
  "sky-grid": false,
  "marker-labels": true,
  "below-horizon-markers": true,
};

export type BodyReadout = {
  id: SkyBodyId;
  label: string;
  magnitude: number;
  distanceFromObserverM: number;
  /** 0 for the Sun itself. */
  distanceFromSunM: number;
  /** Sunlit share of the disc as seen from Earth (1 for the Sun). */
  illuminatedFraction: number;
  /** Which limb the Sun lights in the inset disc (toward the Sun's side of the sky). */
  litOnRight: boolean;
};

type AppState = {
  targetDistanceM: number;
  telemetry: RendererTelemetry;
  skyReadout: SkyReadout | null;
  openingTargetLabel: string | null;
  selectedBodyId: SkyBodyId | null;
  layers: LayersState;
  /** Live device-compass heading in degrees, or null when compass mode is off. */
  compassHeadingDeg: number | null;
  /** Live device pitch (0 horizon, +90 zenith), or null when unavailable. */
  compassPitchDeg: number | null;
  /**
   * Full device attitude for the camera (local-frame quaternion [x,y,z,w]).
   * Preferred over heading+pitch: it has no zenith gimbal lock.
   */
  compassQuaternion: [number, number, number, number] | null;
  /** True while the shared phone-look session streams device orientation. */
  phoneLookActive: boolean;
  reducedMotion: boolean;
  setTargetDistanceM: (distanceM: number) => void;
  setTelemetry: (telemetry: RendererTelemetry) => void;
  setSkyReadout: (skyReadout: SkyReadout) => void;
  setOpeningTargetLabel: (label: string) => void;
  setSelectedBodyId: (bodyId: SkyBodyId | null) => void;
  setLayer: (layer: LayerId, enabled: boolean) => void;
  setCompassLook: (
    headingDeg: number | null,
    pitchDeg: number | null,
    quaternion?: [number, number, number, number] | null,
  ) => void;
  setPhoneLookActive: (active: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
};

export const INITIAL_TELEMETRY: RendererTelemetry = {
  backend: "Initializing…",
  currentDistanceM: JOURNEY_MIN_DISTANCE_M,
  scaleDomain: "local",
  fps: 0,
  averageFrameMs: 0,
  worstFrameMs: 0,
  drawCalls: 0,
  geometries: 0,
  textures: 0,
  renderScale: 0,
  estimatedJitterM: 0,
  orientationOffsetDeg: 0,
  headingDeg: 0,
  simulationUtcMs: 0,
};

export const useAppStore = create<AppState>((set) => ({
  targetDistanceM: JOURNEY_MIN_DISTANCE_M,
  telemetry: INITIAL_TELEMETRY,
  skyReadout: null,
  openingTargetLabel: null,
  selectedBodyId: null,
  layers: DEFAULT_LAYERS,
  compassHeadingDeg: null,
  compassPitchDeg: null,
  compassQuaternion: null,
  phoneLookActive: false,
  reducedMotion:
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  setTargetDistanceM: (targetDistanceM) => set({ targetDistanceM }),
  setTelemetry: (telemetry) => set({ telemetry }),
  setSkyReadout: (skyReadout) => set({ skyReadout }),
  setOpeningTargetLabel: (openingTargetLabel) => set({ openingTargetLabel }),
  setSelectedBodyId: (selectedBodyId) => set({ selectedBodyId }),
  setLayer: (layer, enabled) => set((state) => ({ layers: { ...state.layers, [layer]: enabled } })),
  setCompassLook: (compassHeadingDeg, compassPitchDeg, compassQuaternion = null) =>
    set({ compassHeadingDeg, compassPitchDeg, compassQuaternion }),
  setPhoneLookActive: (phoneLookActive) => set({ phoneLookActive }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
