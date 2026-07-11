import * as THREE from "three/webgpu";

import type { DepthPreference, RendererPreference } from "../app/feature-flags";

export type RendererBackend = "WebGPU" | "WebGL 2";

export type RendererBundle = {
  renderer: THREE.WebGPURenderer;
  backend: RendererBackend;
};

export async function createRenderer(
  canvas: HTMLCanvasElement,
  rendererPreference: RendererPreference,
  depthPreference: DepthPreference,
): Promise<RendererBundle> {
  const forceWebGL = rendererPreference === "webgl";
  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: true,
    alpha: false,
    forceWebGL,
    reversedDepthBuffer: depthPreference === "reversed",
    logarithmicDepthBuffer: depthPreference === "log",
    powerPreference: "high-performance",
  });

  await renderer.init();

  const backendState = renderer as THREE.WebGPURenderer & {
    backend?: { isWebGPUBackend?: boolean };
  };
  const backend: RendererBackend =
    !forceWebGL && backendState.backend?.isWebGPUBackend ? "WebGPU" : "WebGL 2";

  return { renderer, backend };
}
