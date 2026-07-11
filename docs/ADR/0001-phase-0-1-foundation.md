# ADR 0001: Phase 0–1 web foundation

- Status: Accepted
- Date: 2026-07-11

## Context

`SPEC.md` requires a strict TypeScript web application whose first delivery proves a continuous ground-to-whole-Earth journey. It selects Vite, React, Tailwind CSS, Zustand, Vitest, Playwright, pnpm, direct Three.js, and `WebGPURenderer` with WebGL 2 fallback.

## Decision

Use the selected stack directly. React owns the interface and Zustand state. A long-lived imperative renderer owns Three.js scene objects and the frame loop. Browser acceptance is performed with the current agent-oriented Playwright CLI via `pnpx @playwright/cli@latest` in addition to repeatable Playwright tests.

Pin the resolved Three.js version in `pnpm-lock.yaml`. Import the WebGPU build from `three/webgpu`, use only renderer-compatible built-in/node materials, and expose `renderer=webgl`.

Run browser scenarios through one Playwright worker. Multiple simultaneous WebGPU-renderer instances and screenshot readbacks contend for the same headless GPU process and made otherwise passing drag/capture scenarios exceed their time budgets; serial projects keep this GPU-bound acceptance suite deterministic.

## Consequences

The UI can update independently of render cadence, WebGPU is preferred where supported, and the same code path remains testable on WebGL 2. The WebGPU renderer is still evolving, so its backend and depth behavior must be verified after upgrades.

## Verification

`pnpm check`, production build, browser backend readout, forced-WebGL browser run, and Playwright screenshots.
