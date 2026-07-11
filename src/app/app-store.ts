import { create } from "zustand";

import { PHASE_ONE_MIN_DISTANCE_M } from "../camera/scale-domains";

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
};

type AppState = {
  targetDistanceM: number;
  telemetry: RendererTelemetry;
  reducedMotion: boolean;
  setTargetDistanceM: (distanceM: number) => void;
  setTelemetry: (telemetry: RendererTelemetry) => void;
  setReducedMotion: (enabled: boolean) => void;
};

export const INITIAL_TELEMETRY: RendererTelemetry = {
  backend: "Initializing…",
  currentDistanceM: PHASE_ONE_MIN_DISTANCE_M,
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
};

export const useAppStore = create<AppState>((set) => ({
  targetDistanceM: PHASE_ONE_MIN_DISTANCE_M,
  telemetry: INITIAL_TELEMETRY,
  reducedMotion:
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  setTargetDistanceM: (targetDistanceM) => set({ targetDistanceM }),
  setTelemetry: (telemetry) => set({ telemetry }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
