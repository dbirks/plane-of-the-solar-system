# Repository agent guide

## Mission and source of truth

Build the experience described by `SPEC.md`. Read that file completely before changing product behavior. The current implementation gate is the “First task for the coding agent”: finish Phase 0 and Phase 1 and prove the precision vertical slice before adding astronomy features.

When a later specification conflicts with this repository, stop and reconcile the documents explicitly rather than silently choosing one.

## Working agreements

- Use `pnpm` for dependencies and repository scripts. Use `pnpx @playwright/cli@latest` for interactive browser acceptance checks.
- Keep TypeScript strict. Use Oxc (`oxlint` and `oxfmt`) for linting and formatting, and run `pnpm check` before handing work off.
- Keep physics, coordinates, and simulation state independent of Three.js.
- Include units and coordinate frames in variable names. Canonical physical distances are double-precision meters.
- Keep celestial objects true-size and distances uncompressed. Discoverability belongs to UI markers.
- Keep React out of the per-frame render loop. React owns controls and readouts; the renderer owns animation.
- Preserve reproducible query parameters: `time`, `lat`, `lon`, `renderer`, `depth`, `quality`, and `debug`.
- Do not introduce React Three Fiber, Cesium, Stellarium, Rust, WebAssembly, or a generalized astronomy engine.
- Never add a permission prompt to the opening path.

## Architecture decision records

Architectural and technical decisions live in `docs/ADR/` and use the filename form `NNNN-short-title.md`.

Create or amend an ADR in the same change whenever work:

- adds or replaces a dependency, renderer, coordinate frame, persistence mechanism, or build/test tool;
- changes the precision, camera, depth-buffer, scaling, input, asset, or performance strategy;
- deliberately accepts a trade-off or defers a spec requirement;
- reverses a previous decision.

An ADR must record status, context, decision, consequences, and verification. Do not create ADR noise for formatting, typo, or direct implementation-only fixes that do not change a technical decision.

## Verification

- Add unit tests for coordinate transforms and numeric behavior.
- Use fixed times and locations for screenshots.
- Exercise visible controls through Playwright, not only by calling internal APIs.
- Inspect captured screenshots at mobile and desktop sizes.
- Record measured renderer/backend, clipping, depth mode, jitter, frame time, draw calls, texture memory, and known artifacts in the phase precision report.
- Do not claim a phase complete until its definition of done is evidenced by current tests and browser output.

## Documentation map

- `docs/ARCHITECTURE.md`: runtime boundaries and system overview
- `docs/COORDINATES.md`: every coordinate frame and mapping
- `docs/ASSETS.md`: every external asset, version, source, and license
- `docs/PERFORMANCE.md`: current budgets and measured results
- `docs/PRECISION_REPORT.md`: Phase 1 browser measurements and findings
- `docs/ADR/`: decision history
