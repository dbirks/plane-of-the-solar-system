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
};

type AppState = {
  targetDistanceM: number;
  telemetry: RendererTelemetry;
  skyReadout: SkyReadout | null;
  openingTargetLabel: string | null;
  selectedBodyId: SkyBodyId | null;
  reducedMotion: boolean;
  setTargetDistanceM: (distanceM: number) => void;
  setTelemetry: (telemetry: RendererTelemetry) => void;
  setSkyReadout: (skyReadout: SkyReadout) => void;
  setOpeningTargetLabel: (label: string) => void;
  setSelectedBodyId: (bodyId: SkyBodyId | null) => void;
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
  reducedMotion:
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  setTargetDistanceM: (targetDistanceM) => set({ targetDistanceM }),
  setTelemetry: (telemetry) => set({ telemetry }),
  setSkyReadout: (skyReadout) => set({ skyReadout }),
  setOpeningTargetLabel: (openingTargetLabel) => set({ openingTargetLabel }),
  setSelectedBodyId: (selectedBodyId) => set({ selectedBodyId }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
